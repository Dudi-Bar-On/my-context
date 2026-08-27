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
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
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
    await upkeepUiServer(sb.root, OFF, NOW, { globalRoot: sb.globalRoot, spawnFn: spawner.fn }),
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
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn }),
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
        { globalRoot: sb.globalRoot, spawnFn: spawner.fn }),
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
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn }),
    { did: 'spawned', port: PORT },
  );
  assert.equal(spawner.calls.length, 1);
});

/* ---------------------------------------------------------------------------
 * The two intervals, and they are two.
 * ------------------------------------------------------------------------- */

test('the PROBE is floored at 60 seconds', async () => {
  const sb = sandbox();
  const deps = { globalRoot: sb.globalRoot, spawnFn: fakeSpawn().fn };
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
  const deps = { globalRoot: sb.globalRoot, spawnFn: spawner.fn };

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
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn });
    at += SPAWN_INTERVAL_MS + 1_000;
  }
  return at;
}

test('three failed spawns stand the mechanism down for the session', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  // Three attempts, so three spawns have been made; the third is CONFIRMED
  // failed by the probe on the turn after it, and that is the turn it gives up.
  const at = await failingSpawns(sb, spawner, MAX_CONSECUTIVE_SPAWN_FAILURES);
  assert.equal(spawner.calls.length, MAX_CONSECUTIVE_SPAWN_FAILURES);

  assert.deepEqual(
    await upkeepUiServer(sb.root, CONFIGURED, at,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn }),
    { did: 'stood-down', failures: MAX_CONSECUTIVE_SPAWN_FAILURES },
  );
  assert.equal(spawner.calls.length, MAX_CONSECUTIVE_SPAWN_FAILURES,
    'a fourth spawn was attempted on the very turn the mechanism gave up');

  // And it STAYS down. `stood-down` is reported on exactly one turn and
  // `nothing` thereafter, which is what gives the caller exactly one turn on
  // which it has something to disclose.
  assert.deepEqual(
    await upkeepUiServer(sb.root, CONFIGURED, at + SPAWN_INTERVAL_MS + 1_000,
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn }),
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
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn });
  await close();
  assert.deepEqual(alive, { did: 'nothing', why: 'alive' },
    'the probe did not find the server that was plainly there');

  // Nothing is listening again. Without the reset the next confirmed failure
  // would be the third and the mechanism would give up; with it the count
  // starts over and the spawns resume.
  let now = at + SPAWN_INTERVAL_MS + 1_000;
  assert.equal((await upkeepUiServer(sb.root, CONFIGURED, now,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn })).did, 'spawned');
  now += SPAWN_INTERVAL_MS + 1_000;
  assert.equal((await upkeepUiServer(sb.root, CONFIGURED, now,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn })).did, 'spawned',
  'a server that came back did not clear the failures counted before it did');
});

/* ---------------------------------------------------------------------------
 * The spawn shape, which is not a style question.
 * ------------------------------------------------------------------------- */

test('the spawn is detached, ignores its stdio, and never opens a browser', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  await upkeepUiServer(sb.root, CONFIGURED, NOW,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn });

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
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn });
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
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn });
  assert.deepEqual(readdirSync(sb.stateDir), [path.basename(upkeepStatePath(sb.root))],
    'per-session state would let two concurrent sessions in one repository spawn two servers ' +
    'inside one 5-minute window, which is the storm the floor exists to prevent');
});

test('a clock that went backwards does not freeze the mechanism', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  await upkeepUiServer(sb.root, CONFIGURED, NOW,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn });
  // A stored timestamp in the future is what a corrected clock, a daylight
  // shift or a state file copied between machines looks like. Waiting it out
  // would be waiting for a moment that has already passed.
  const back = await upkeepUiServer(sb.root, CONFIGURED, NOW - 60 * 60_000,
    { globalRoot: sb.globalRoot, spawnFn: spawner.fn });
  assert.notEqual(back.did === 'nothing' ? back.why : null, 'too-soon',
    'a clock that went backwards froze the upkeep until wall time caught up again');
});
