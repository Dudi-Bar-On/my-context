/**
 * **The two floors, the stand-down, and the machine that never asked.**
 *
 * `plan:upkeep seq:5`. The mechanism under test is the one the owner asked for
 * on 2026-08-27 — *"check if the app server is running, if not running and not
 * disabled start it up, find the correct interval for this test to not overload
 * the system"* — and the last clause is what most of this file is about.
 *
 * Three properties, and every test below is one of them:
 *
 *  1. **Off unless configured.** With `ui.port` absent nothing is probed,
 *     nothing is spawned and NOT ONE BYTE is written. That is a safety call
 *     rather than a default: a plugin that starts a background server on every
 *     machine it is installed on, because somebody installed it, is not
 *     acceptable. `ui.enabled: false` turns it off again without unsetting the
 *     port.
 *  2. **Two intervals, and they are not the same interval.** The probe is a
 *     file read and a loopback connect, floored at 60 seconds because that is
 *     how long the owner would sit looking at a dead tab. The spawn is a
 *     process, floored at 5 minutes because a hook that retries a failing spawn
 *     every minute forever is the only path here that can overload a machine.
 *     Conflating them is the defect, and `the SPAWN is floored ... separately`
 *     is the test that catches it.
 *  3. **A refusal is a state to leave.** Three consecutive failed spawns stand
 *     the mechanism down, and a spawn counts as FAILED when the next probe
 *     still finds nothing — not when `spawn` throws. A detached child that dies
 *     a second later throws nothing, and that is precisely the failure the
 *     counter is for.
 *
 * **Every clock is passed in.** Not one test sleeps: an interval test that
 * waits for its own interval is a test that takes five minutes and still cannot
 * say which side of the boundary it landed on.
 *
 * **Every spawn is a fake and every record is in a temp directory.** The real
 * spawn would leave a UI server running on the machine that ran the suite, and
 * `test/core/real-home-guard.test.ts` exists because code once wrote to the
 * real home and turned 134 unrelated tests red.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import type { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveConfig, type Config } from '../../src/core/config.ts';
import { writeUiServerRecord } from '../../src/core/ui-server-record.ts';
import {
  MAX_CONSECUTIVE_SPAWN_FAILURES, PROBE_FLOOR_MS, SPAWN_INTERVAL_MS,
  upkeepStandDownLine, upkeepStatePath, upkeepUiServer,
} from '../../src/core/ui-server-upkeep.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A fixed wall clock. Every test moves it by hand; nothing here waits. */
const NOW = 1_756_300_000_000;
const PORT = 58888;

const bases: string[] = [];
after(() => { for (const base of bases) removeTree(base); });

const OFF: Config = resolveConfig({});
const CONFIGURED: Config = resolveConfig({ ui: { port: PORT } });
const DISABLED: Config = resolveConfig({ ui: { enabled: false, port: PORT } });

/**
 * The occupancy check, answered "nothing is there" without touching a socket.
 *
 * **Every existing test below passes this, and none of them may go without
 * it.** `PORT` above is 58888 — a real port on the machine running the suite,
 * and the very port the owner's own UI server sits on. Left to the real check,
 * `a dead server is spawned back` would connect to that server, correctly
 * conclude the port was already serving, and fail; the suite's answer would
 * then depend on what else the developer happened to have open. That is the
 * same class of coupling `test/core/real-home-guard.test.ts` was written for,
 * one layer out: a unit test reaching real machine state.
 *
 * The REAL check is exercised by `a port that is already serving ...` below,
 * which binds its own listener on an ephemeral port and configures that.
 */
const NOTHING_ON_THE_PORT = async (): Promise<boolean> => false;

interface Sandbox {
  /** The workspace directory, as every hook builder is handed it. */
  root: string;
  /** A stand-in for `~/.my-context`, where the liveness record lives. */
  globalRoot: string;
  /** `<root>/state` — the directory the "nothing is written" tests read back. */
  stateDir: string;
}

function sandbox(): Sandbox {
  const base = mkdtempSync(path.join(tmpdir(), 'uiupkeep-'));
  bases.push(base);
  const root = path.join(base, '.my_context');
  const stateDir = path.join(root, 'state');
  mkdirSync(stateDir, { recursive: true });
  return { root, globalRoot: path.join(base, 'global'), stateDir };
}

interface FakeChild extends EventEmitter {
  pid?: number | undefined;
  unref(): void;
}

interface FakeSpawn {
  calls: { command: string; args: string[]; options: Record<string, unknown> }[];
  unrefs: number;
  children: FakeChild[];
  fn: typeof spawn;
}

/**
 * A `spawn` stand-in — `test/ui/open.test.ts`'s shape, for its reason. The real
 * one would leave a UI server running on the machine under test, and a fake is
 * the only way to read back the argument vector and the options object, which
 * is where `detached`, `stdio` and `--no-open` either are or are not.
 */
function fakeSpawn(): FakeSpawn {
  const fake: FakeSpawn = {
    calls: [], unrefs: 0, children: [], fn: null as unknown as typeof spawn,
  };
  fake.fn = ((command: string, args: string[], options: Record<string, unknown>) => {
    fake.calls.push({ command, args, options });
    const child = new EventEmitter() as FakeChild;
    child.pid = 4242;
    child.unref = (): void => { fake.unrefs += 1; };
    fake.children.push(child);
    return child as unknown as ChildProcess;
  }) as unknown as typeof spawn;
  return fake;
}

/**
 * A real listening socket, plus the record that points at it — which is the
 * only thing that can make a probe answer `alive`, since the probe reads the
 * record and never the config.
 *
 * Closing it leaves the record behind on purpose: a record that outlives its
 * server is the normal case rather than the exotic one, and it is exactly what
 * the probe has to disbelieve.
 */
async function serverAt(globalRoot: string): Promise<() => Promise<void>> {
  const server = net.createServer((socket) => socket.end());
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const { port } = server.address() as net.AddressInfo;
  writeUiServerRecord({
    version: 1,
    pid: process.pid,
    host: '127.0.0.1',
    port,
    url: `http://127.0.0.1:${port}/`,
    startedAt: NOW,
    workspace: 'D:\\repo',
  }, globalRoot);
  return () => new Promise<void>((resolve) => { server.close(() => resolve()); });
}

/* ---------------------------------------------------------------------------
 * Off unless configured.
 * ------------------------------------------------------------------------- */

test('with ui.port absent nothing happens and NOTHING is written', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  assert.deepEqual(
    await upkeepUiServer(sb.root, OFF, NOW,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }),
    { did: 'nothing', why: 'off' },
  );
  assert.equal(spawner.calls.length, 0);
  assert.deepEqual(readdirSync(sb.stateDir), [],
    'an unconfigured workspace was made to carry state for a mechanism it never turned on — ' +
    'the opt-in has to cost nothing at all, or it is not an opt-in');
});

test('with ui.enabled false nothing happens even when a port is set', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  assert.deepEqual(
    await upkeepUiServer(sb.root, DISABLED, NOW,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }),
    { did: 'nothing', why: 'disabled' },
  );
  assert.equal(spawner.calls.length, 0);
  assert.deepEqual(readdirSync(sb.stateDir), [],
    'ui.enabled: false is the off switch, and an off switch that leaves a clock running is a ' +
    'switch somebody will one day have to explain');
});

/* ---------------------------------------------------------------------------
 * A server that is there, and one that is not.
 * ------------------------------------------------------------------------- */

test('a live server is left alone', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const close = await serverAt(sb.globalRoot);
  try {
    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, NOW,
        { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }),
      { did: 'nothing', why: 'alive' },
    );
    assert.equal(spawner.calls.length, 0, 'a second server was started over a live one');
  } finally {
    await close();
  }
});

test('a dead server is spawned back — once', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  assert.deepEqual(
    await upkeepUiServer(sb.root, CONFIGURED, NOW,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }),
    { did: 'spawned', port: PORT },
  );
  assert.equal(spawner.calls.length, 1);
});

/* ---------------------------------------------------------------------------
 * The two intervals, and they are two.
 * ------------------------------------------------------------------------- */

test('the PROBE is floored at 60 seconds', async () => {
  const sb = sandbox();
  const deps = {
    globalRoot: sb.globalRoot, spawnFn: fakeSpawn().fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  };
  // Against a LIVE server, because `alive` is the one answer only a probe that
  // actually ran can produce. Told apart from a spawn floor's `too-soon`, which
  // is a different guard reading a different clock.
  const close = await serverAt(sb.globalRoot);
  try {
    assert.deepEqual(await upkeepUiServer(sb.root, CONFIGURED, NOW, deps),
      { did: 'nothing', why: 'alive' });
    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, NOW + PROBE_FLOOR_MS - 1_000, deps),
      { did: 'nothing', why: 'too-soon' },
      'the probe ran again inside its floor — on a hook that fires every assistant turn that is ' +
      'a connect per turn, and the floor is what makes the cost statable',
    );
    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, NOW + PROBE_FLOOR_MS + 1_000, deps),
      { did: 'nothing', why: 'alive' },
      'the probe did not come round again a minute later — the whole bound is that the owner ' +
      'waits one turn or one minute, whichever is longer',
    );
  } finally {
    await close();
  }
});

test('the SPAWN is floored at 5 minutes, separately from the probe', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const deps = {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  };

  assert.equal((await upkeepUiServer(sb.root, CONFIGURED, NOW, deps)).did, 'spawned');
  // A minute later the PROBE is due and runs; the SPAWN is not, and does not.
  assert.equal(
    (await upkeepUiServer(sb.root, CONFIGURED, NOW + PROBE_FLOOR_MS + 1_000, deps)).did,
    'nothing',
  );
  assert.equal(spawner.calls.length, 1,
    'the spawn floor was read off the probe floor — one interval for both is how this ' +
    'mechanism overloads a machine, and it is the only path here that can');
  assert.equal(
    (await upkeepUiServer(sb.root, CONFIGURED, NOW + SPAWN_INTERVAL_MS + 1_000, deps)).did,
    'spawned',
  );
  assert.equal(spawner.calls.length, 2);
});

/* ---------------------------------------------------------------------------
 * Giving up, which is a state and not a silence.
 * ------------------------------------------------------------------------- */

/** `attempts` spawn attempts, one every 5 minutes and a second, none answering. */
async function failingSpawns(sb: Sandbox, spawner: FakeSpawn, attempts: number): Promise<number> {
  let at = NOW;
  for (let i = 0; i < attempts; i += 1) {
    await upkeepUiServer(sb.root, CONFIGURED, at,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
    at += SPAWN_INTERVAL_MS + 1_000;
  }
  return at;
}

test('three failed spawns stand the mechanism down while nothing is serving', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  // Three attempts, so three spawns have been made; the third is CONFIRMED
  // failed by the probe on the turn after it, and that is the turn it gives up.
  const at = await failingSpawns(sb, spawner, MAX_CONSECUTIVE_SPAWN_FAILURES);
  assert.equal(spawner.calls.length, MAX_CONSECUTIVE_SPAWN_FAILURES);

  assert.deepEqual(
    await upkeepUiServer(sb.root, CONFIGURED, at,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }),
    { did: 'stood-down', failures: MAX_CONSECUTIVE_SPAWN_FAILURES },
  );
  assert.equal(spawner.calls.length, MAX_CONSECUTIVE_SPAWN_FAILURES,
    'a fourth spawn was attempted on the very turn the mechanism gave up');

  // And it STAYS down for as long as nothing answers — which is the condition,
  // and since 2026-08-31 it is the whole condition: a server that turns up
  // lifts it (see the lift tests below). `stood-down` is reported on exactly
  // one turn and `nothing` thereafter, which is what gives the caller exactly
  // one turn on which it has something to disclose.
  assert.deepEqual(
    await upkeepUiServer(sb.root, CONFIGURED, at + SPAWN_INTERVAL_MS + 1_000,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }),
    { did: 'nothing', why: 'stood-down' },
  );
  assert.equal(spawner.calls.length, MAX_CONSECUTIVE_SPAWN_FAILURES,
    'a mechanism that cannot start a server needs a human, not another attempt');
});

test('the stand-down line names the key and the file that undoes it', () => {
  const line = upkeepStandDownLine(MAX_CONSECUTIVE_SPAWN_FAILURES, path.join('X', '.my_context'));
  assert.match(line, /^my_context: /u);
  assert.match(line, /ui\.port/u);
  assert.match(line, /ui-server-upkeep\.json/u,
    'a refusal that does not say how to leave it is a refusal nobody can act on');
  assert.ok(line.endsWith('\n'), 'a stderr line that does not end runs into whatever is next');
});

test('a successful probe resets the failure counter', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  // Two confirmed failures and a third spawn outstanding — one probe short of
  // standing down.
  const at = await failingSpawns(sb, spawner, MAX_CONSECUTIVE_SPAWN_FAILURES);
  assert.equal(spawner.calls.length, MAX_CONSECUTIVE_SPAWN_FAILURES);

  const close = await serverAt(sb.globalRoot);
  const alive = await upkeepUiServer(sb.root, CONFIGURED, at,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
  await close();
  assert.deepEqual(alive, { did: 'nothing', why: 'alive' },
    'the probe did not find the server that was plainly there');

  // Nothing is listening again. Without the reset the next confirmed failure
  // would be the third and the mechanism would give up; with it the count
  // starts over and the spawns resume.
  let now = at + SPAWN_INTERVAL_MS + 1_000;
  assert.equal((await upkeepUiServer(sb.root, CONFIGURED, now,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }))
    .did, 'spawned');
  now += SPAWN_INTERVAL_MS + 1_000;
  assert.equal((await upkeepUiServer(sb.root, CONFIGURED, now,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }))
    .did, 'spawned',
  'a server that came back did not clear the failures counted before it did');
});

/* ---------------------------------------------------------------------------
 * The spawn shape, which is not a style question.
 * ------------------------------------------------------------------------- */

test('the spawn is detached, ignores its stdio, and never opens a browser', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  await upkeepUiServer(sb.root, CONFIGURED, NOW,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });

  assert.equal(spawner.calls.length, 1);
  const call = spawner.calls[0];
  assert.equal(call.command, process.execPath, 'the child must be this Node, not a shell');
  assert.deepEqual(call.options, { detached: true, stdio: 'ignore' },
    'Stop runs on a 3-second timeout the platform genuinely waits on, and a child holding the ' +
    'parent event loop open turns every assistant turn into a three-second pause');
  assert.equal(spawner.unrefs, 1, 'detached without unref keeps the parent alive anyway');
  assert.ok(call.args[0].endsWith(path.join('cli', 'index.ts')), call.args[0]);
  assert.deepEqual(call.args.slice(1), ['ui', '--port', String(PORT), '--no-open'],
    'a hook that launches a browser window mid-turn is a hook nobody keeps installed');
});

test('the spawn goes to the CONFIGURED port, never to an ephemeral one', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  await upkeepUiServer(sb.root, resolveConfig({ ui: { port: 41_000 } }), NOW,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
  assert.ok(spawner.calls[0].args.includes('41000'),
    'port 0 is the CLI default, and an ephemeral port is a URL nobody can bookmark — which is ' +
    'the whole reason ui.port exists');
});

/* ---------------------------------------------------------------------------
 * The state file itself.
 * ------------------------------------------------------------------------- */

test('the clocks live in one file per WORKSPACE, not one per session', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  await upkeepUiServer(sb.root, CONFIGURED, NOW,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
  assert.deepEqual(readdirSync(sb.stateDir), [path.basename(upkeepStatePath(sb.root))],
    'per-session state would let two concurrent sessions in one repository spawn two servers ' +
    'inside one 5-minute window, which is the storm the floor exists to prevent');
});

test('a clock that went backwards does not freeze the mechanism', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  await upkeepUiServer(sb.root, CONFIGURED, NOW,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
  // A stored timestamp in the future is what a corrected clock, a daylight
  // shift or a state file copied between machines looks like. Waiting it out
  // would be waiting for a moment that has already passed.
  const back = await upkeepUiServer(sb.root, CONFIGURED, NOW - 60 * 60_000,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
  assert.notEqual(back.did === 'nothing' ? back.why : null, 'too-soon',
    'a clock that went backwards froze the upkeep until wall time caught up again');
});

/* ---------------------------------------------------------------------------
 * The three states the state file has to tell apart.
 *
 * **This section is the 2026-08-31 defect.** On that day a reader opened
 * `ui-server-upkeep.json`, saw `consecutiveSpawnFailures: 3, stoodDown: true`,
 * concluded the owner's server had been down for two hours, told them so, and
 * started a second server to "restore" it. A healthy server had been serving
 * the configured port the whole time. The counter was not wrong — it was the
 * only thing recorded, and a count cannot carry a cause.
 *
 * Everything below asserts a DISTINCTION rather than a value: two opposite
 * situations must not produce the same file.
 * ------------------------------------------------------------------------- */

/** The state file as it stands, parsed. */
function stateOf(root: string): Record<string, unknown> {
  return JSON.parse(readFileSync(upkeepStatePath(root), 'utf8')) as Record<string, unknown>;
}

/**
 * A REAL listener on an ephemeral port, and no record anywhere — the shape of
 * the incident: a server that is up and serving, and a probe with nothing to
 * aim at, because the record write lost a race (`ui-server-record.ts` measured
 * exactly that on 2026-08-28).
 *
 * Ephemeral rather than `PORT`, so the test binds a port nothing else can be
 * on. A fixed number here would be a test that fails when the developer's own
 * server is running — which is the failure it is written to prevent.
 */
async function occupiedPort(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer((socket) => socket.end());
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  };
}

test('a port that is already serving is not a failed spawn, and says so', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const held = await occupiedPort();
  try {
    // No record, so the probe has nothing to aim at and answers `no-record`.
    // The REAL occupancy check runs here — this is the one test that uses it.
    assert.deepEqual(
      await upkeepUiServer(sb.root, resolveConfig({ ui: { port: held.port } }), NOW,
        { globalRoot: sb.globalRoot, spawnFn: spawner.fn }),
      { did: 'nothing', why: 'port-already-serving' },
      'a spawn was judged without asking whether anything was already on the port — which is '
      + 'how a server that was serving perfectly got recorded three times as one that could '
      + 'not start',
    );
    assert.equal(spawner.calls.length, 0,
      'a process was started into a port that was already answering: its only possible outcome '
      + 'is EADDRINUSE, and its only lasting effect is a failure counted against a live server');
    assert.equal(stateOf(sb.root)['lastOutcome'], 'port-already-serving',
      'the state file records the count and not the cause, which is the whole defect');
    assert.equal(stateOf(sb.root)['consecutiveSpawnFailures'], 0);
  } finally {
    await held.close();
  }
});

test('an occupied port NEVER stands the mechanism down, however long it lasts', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const held = await occupiedPort();
  const config = resolveConfig({ ui: { port: held.port } });
  try {
    let at = NOW;
    // Twice the threshold, so a mechanism that counted these would have given
    // up twice over.
    for (let i = 0; i < MAX_CONSECUTIVE_SPAWN_FAILURES * 2; i += 1) {
      await upkeepUiServer(sb.root, config, at, { globalRoot: sb.globalRoot, spawnFn: spawner.fn });
      at += SPAWN_INTERVAL_MS + 1_000;
    }
    assert.equal(stateOf(sb.root)['stoodDown'], false,
      'the upkeep stood down over a port that was serving the owner the entire time — and a '
      + 'stand-down is permanent, so that is a state a person has to come and delete by hand');
    assert.equal(spawner.calls.length, 0);
  } finally {
    await held.close();
  }
});

test('the two opposite situations do NOT produce the same state file', async () => {
  // The genuine failure: nothing on the port, three spawns, three confirmations.
  const broken = sandbox();
  const spawner = fakeSpawn();
  const at = await failingSpawns(broken, spawner, MAX_CONSECUTIVE_SPAWN_FAILURES);
  await upkeepUiServer(broken.root, CONFIGURED, at,
    { globalRoot: broken.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });

  // The healthy one: a port already serving, refused the same number of times.
  const healthy = sandbox();
  const quiet = fakeSpawn();
  const held = await occupiedPort();
  const config = resolveConfig({ ui: { port: held.port } });
  try {
    let now = NOW;
    for (let i = 0; i <= MAX_CONSECUTIVE_SPAWN_FAILURES; i += 1) {
      await upkeepUiServer(healthy.root, config, now,
        { globalRoot: healthy.globalRoot, spawnFn: quiet.fn });
      now += SPAWN_INTERVAL_MS + 1_000;
    }
  } finally {
    await held.close();
  }

  assert.equal(stateOf(broken.root)['lastOutcome'], 'stood-down');
  assert.equal(stateOf(healthy.root)['lastOutcome'], 'port-already-serving');
  assert.notDeepEqual(
    { ...stateOf(broken.root), lastProbeAt: 0, lastSpawnAt: 0 },
    { ...stateOf(healthy.root), lastProbeAt: 0, lastSpawnAt: 0 },
    'a server too broken to start and a port already serving happily wrote indistinguishable '
    + 'state — that is the whole defect, and a reader acted on it',
  );
});

test('a spawn refused by the floor is recorded as a policy refusal, not a failure', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const deps = {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  };
  await upkeepUiServer(sb.root, CONFIGURED, NOW, deps);
  assert.equal(stateOf(sb.root)['lastOutcome'], 'spawned');

  // A minute later: the probe is due, the spawn is not.
  await upkeepUiServer(sb.root, CONFIGURED, NOW + PROBE_FLOOR_MS + 1_000, deps);
  assert.equal(stateOf(sb.root)['lastOutcome'], 'too-soon',
    'a spawn the mechanism itself declined to make was left looking like one that failed');
});

test('a lastOutcome this build does not know degrades to null, never to a guess', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const deps = {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  };
  await upkeepUiServer(sb.root, CONFIGURED, NOW, deps);
  writeFileSync(upkeepStatePath(sb.root),
    JSON.stringify({ ...stateOf(sb.root), lastOutcome: 'invented-by-a-later-build' }), 'utf8');
  // Read back as null and simply replaced. Nothing downstream branches on a
  // value it does not understand, which is `readUiServerRecord`'s posture.
  await upkeepUiServer(sb.root, CONFIGURED, NOW + PROBE_FLOOR_MS + 1_000, deps);
  assert.equal(stateOf(sb.root)['lastOutcome'], 'too-soon');
});

test('the stand-down line says the port was checked, in the sentence that claims it', () => {
  const line = upkeepStandDownLine(MAX_CONSECUTIVE_SPAWN_FAILURES, path.join('X', '.my_context'));
  assert.match(line, /not answering/u,
    '"could not be started" was read once as an outage while a healthy server held the port; '
    + 'the claim has to carry the condition under which it holds, in the same sentence');
});

/* ---------------------------------------------------------------------------
 * Standing down is not going quiet, and it is not permanent.
 *
 * **The owner's ruling of 2026-08-31.** Until it, the `stoodDown` guard sat
 * ahead of the probe: a stood-down workspace stopped probing, stopped writing
 * and stopped learning, so a server that came back was never noticed and the
 * feature stayed off with nothing saying so. The guard now gates the SPAWN
 * alone.
 *
 * Every test here asserts a DISTINCTION, the shape the rest of this file uses:
 * a stood-down workspace that is still probing must be tellable from one that
 * has gone quiet, and a lifted one from a workspace that never had trouble.
 * ------------------------------------------------------------------------- */

/** Stands `sb` down: three spawns, none answering, then the turn that gives up. */
async function stoodDownAt(sb: Sandbox, spawner: FakeSpawn): Promise<number> {
  const at = await failingSpawns(sb, spawner, MAX_CONSECUTIVE_SPAWN_FAILURES);
  const gave = await upkeepUiServer(sb.root, CONFIGURED, at,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
  assert.deepEqual(gave, { did: 'stood-down', failures: MAX_CONSECUTIVE_SPAWN_FAILURES });
  assert.equal(stateOf(sb.root)['stoodDown'], true);
  return at + PROBE_FLOOR_MS + 1_000;
}

test('a stood-down workspace KEEPS PROBING, and its state file keeps moving', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  let at = await stoodDownAt(sb, spawner);
  const spawnsWhenItGaveUp = spawner.calls.length;

  const clocks: unknown[] = [];
  for (let i = 0; i < 3; i += 1) {
    const result = await upkeepUiServer(sb.root, CONFIGURED, at,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
    assert.deepEqual(result, { did: 'nothing', why: 'stood-down' });
    clocks.push(stateOf(sb.root)['lastProbeAt']);
    at += PROBE_FLOOR_MS + 1_000;
  }

  assert.deepEqual(clocks, [...new Set(clocks)],
    'the state file stopped moving under a stood-down workspace — which is going quiet, not '
    + 'standing down, and it is how a feature switches itself off with nobody able to tell');
  assert.equal(stateOf(sb.root)['lastOutcome'], 'stood-down',
    'a reader of the file cannot see that these probes are still running and still finding '
    + 'nothing, which is the only thing that distinguishes a live refusal from a dead one');
  assert.equal(spawner.calls.length, spawnsWhenItGaveUp,
    'a stood-down workspace started a process. The probe is what was un-gated; the spawn is '
    + 'the thing the refusal exists to prevent, and it stays prevented');
});

test('a server that answers where the RECORD says lifts the stand-down', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const at = await stoodDownAt(sb, spawner);

  const close = await serverAt(sb.globalRoot);
  try {
    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, at,
        { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }),
      { did: 'nothing', why: 'stood-down-lifted' },
      'the mechanism stayed stood down while a server was plainly answering — the caution was '
      + 'never about probing, and a probe is how it finds out the situation ended');
    const after = stateOf(sb.root);
    assert.equal(after['stoodDown'], false);
    assert.equal(after['consecutiveSpawnFailures'], 0);
    assert.equal(after['lastOutcome'], 'stood-down-lifted');
  } finally {
    await close();
  }
});

test('a CONFIGURED PORT that answers lifts the stand-down too', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  // The occupancy check is the second of the two proofs a server exists, and it
  // is the one that mattered on 2026-08-31: a healthy server whose record was
  // lost is invisible to the probe and visible only here.
  let serving = false;
  const deps = {
    globalRoot: sb.globalRoot,
    spawnFn: spawner.fn,
    portAcceptsFn: async (): Promise<boolean> => serving,
  };
  const at = await failingSpawns(sb, spawner, MAX_CONSECUTIVE_SPAWN_FAILURES);
  await upkeepUiServer(sb.root, CONFIGURED, at, deps);
  assert.equal(stateOf(sb.root)['stoodDown'], true);

  serving = true;
  assert.deepEqual(
    await upkeepUiServer(sb.root, CONFIGURED, at + PROBE_FLOOR_MS + 1_000, deps),
    { did: 'nothing', why: 'stood-down-lifted' });
  assert.equal(stateOf(sb.root)['stoodDown'], false);
  assert.equal(stateOf(sb.root)['lastOutcome'], 'stood-down-lifted');
});

test('a lift is distinguishable from a workspace that was never stood down', async () => {
  // Two workspaces, both looking at the SAME live server on the same turn. One
  // has just recovered from a stand-down; the other never had trouble. Without
  // its own outcome value both would write `alive` and a reader arriving later
  // could not tell that one of them had failed three times an hour ago — which
  // is a flag changing with nothing saying why, the defect `lastOutcome` was
  // added to fix, one level down.
  const recovered = sandbox();
  const untroubled = sandbox();
  const spawner = fakeSpawn();
  const at = await stoodDownAt(recovered, spawner);

  const close = await serverAt(recovered.globalRoot);
  try {
    await upkeepUiServer(recovered.root, CONFIGURED, at,
      { globalRoot: recovered.globalRoot, spawnFn: spawner.fn,
        portAcceptsFn: NOTHING_ON_THE_PORT });
    await upkeepUiServer(untroubled.root, CONFIGURED, at,
      { globalRoot: recovered.globalRoot, spawnFn: spawner.fn,
        portAcceptsFn: NOTHING_ON_THE_PORT });
  } finally {
    await close();
  }

  assert.equal(stateOf(recovered.root)['lastOutcome'], 'stood-down-lifted');
  assert.equal(stateOf(untroubled.root)['lastOutcome'], 'alive');
  assert.notDeepEqual(
    { ...stateOf(recovered.root), lastProbeAt: 0, lastSpawnAt: 0 },
    { ...stateOf(untroubled.root), lastProbeAt: 0, lastSpawnAt: 0 },
    'a workspace that recovered from a stand-down and one that never had trouble wrote '
    + 'indistinguishable state — a mechanism that failed three times and then recovered has '
    + 'something intermittent behind it, and that is worth a reader knowing');
});

test('after a lift the mechanism spawns again, so the lift is not cosmetic', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const deps = {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  };
  let at = await stoodDownAt(sb, spawner);
  const spawnsWhenItGaveUp = spawner.calls.length;

  const close = await serverAt(sb.globalRoot);
  await upkeepUiServer(sb.root, CONFIGURED, at, deps);
  await close();

  // The server has gone again, and the spawn floor has elapsed. A lift that
  // only cleared a flag would leave this workspace refusing forever.
  at += SPAWN_INTERVAL_MS + 1_000;
  assert.deepEqual(await upkeepUiServer(sb.root, CONFIGURED, at, deps),
    { did: 'spawned', port: PORT });
  assert.equal(spawner.calls.length, spawnsWhenItGaveUp + 1);
});

test('a lift does not reach for the stderr the stand-down used', async () => {
  // `did: 'stood-down'` is the ONLY variant `stopUpkeep` discloses on, and a
  // lift must not become a second one. A line reporting that nothing is wrong
  // any more, on a hook that rides every assistant turn, is a smaller occasion
  // than the refusal was — not a larger one.
  const sb = sandbox();
  const spawner = fakeSpawn();
  const at = await stoodDownAt(sb, spawner);
  const close = await serverAt(sb.globalRoot);
  try {
    const lift = await upkeepUiServer(sb.root, CONFIGURED, at,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });
    assert.notEqual(lift.did, 'stood-down',
      'the lift was returned on the one variant the caller writes to stderr on');
  } finally {
    await close();
  }
});

test('the stand-down line says the refusal can end without a person', () => {
  const line = upkeepStandDownLine(MAX_CONSECUTIVE_SPAWN_FAILURES, path.join('X', '.my_context'));
  assert.match(line, /resume by itself/u,
    '"will not try again on its own" is now an overstatement — the mechanism keeps checking '
    + 'and lifts itself — and an overstatement here has a person delete a file they did not '
    + 'need to touch');
  assert.match(line, /ui-server-upkeep\.json/u,
    'the file is still the way out when nothing ever turns up, and the line still has to name it');
});
