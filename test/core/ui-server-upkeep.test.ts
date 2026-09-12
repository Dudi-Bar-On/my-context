// @basis TASK-the-upkeep-stops-the-ui-server-before-it-knows-a-replacement,
//        TASK-the-guard-that-excludes-lanes-from-reaping-the-server-rests,
//        RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the
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
import { execFileSync, spawn as realSpawn, type ChildProcess, type spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveConfig, type Config } from '../../src/core/config.ts';
import type { Freshness } from '../../src/core/ui-server-probe.ts';
import { readUiServerRecord, writeUiServerRecord } from '../../src/core/ui-server-record.ts';
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

/**
 * The configured port answers — the replacement came up.
 *
 * The counterpart to `NOTHING_ON_THE_PORT`, and every restart test that is not
 * ABOUT the confirmation needs it: the confirmation aims the occupancy check at
 * `config.ui.port`, so a restart test left with `NOTHING_ON_THE_PORT` is a test
 * whose replacement never comes up — a different situation from the one it was
 * written for.
 */
const REPLACEMENT_COMES_UP = async (): Promise<boolean> => true;

/** Nothing waits in this file, so the confirmation's poll may not either. */
const NO_WAITING = async (): Promise<void> => {};

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
async function serverAt(
  globalRoot: string, pid: number = process.pid, workspace = 'D:\\repo',
): Promise<() => Promise<void>> {
  // `destroy` and not `end`: since the upkeep may now SPEAK to a server that
  // answers — the freshness ask — this fixture receives bytes rather than only
  // a connect-and-hang-up. A half-closed socket left by `end()` is one this
  // server's own `close()` then waits on for the life of the process, and it
  // hung this file for a minute on 2026-09-02 before the cause was found.
  const server = net.createServer((socket) => socket.destroy());
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const { port } = server.address() as net.AddressInfo;
  writeUiServerRecord({
    version: 1,
    pid,
    host: '127.0.0.1',
    port,
    url: `http://127.0.0.1:${port}/`,
    startedAt: NOW,
    workspace,
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
    { did: 'stood-down', why: 'spawn', failures: MAX_CONSECUTIVE_SPAWN_FAILURES },
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
  await upkeepUiServer(sb.root, CONFIGURED, NOW, {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
    platform: 'linux',
  });

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

/* ---------------------------------------------------------------------------
 * The breakaway: a server the hook's own death may not take with it.
 *
 * `TASK-the-guard-that-excludes-lanes-from-reaping-the-server-rests`. The
 * hook's spawn was `detached: true` + `unref()` and that answers only "does it
 * survive a parent that EXITS". Claude Code 2.1.261 kills an overrunning hook
 * on Windows with `taskkill.exe /PID <hook> /T /F`, and `/T` takes every live
 * descendant with it. So on Windows the launch goes through a `cmd.exe` that
 * exits at once, and the server is nobody's live descendant by the time the
 * kill lands.
 * ------------------------------------------------------------------------- */

test('on Windows the server is launched through a parent that exits, not as the hook\'s own child', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  await upkeepUiServer(sb.root, CONFIGURED, NOW, {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
    platform: 'win32',
  });

  assert.equal(spawner.calls.length, 1);
  const call = spawner.calls[0];
  assert.ok(/cmd\.exe$/i.test(call.command), `the launcher must be cmd.exe, got ${call.command}`);
  assert.deepEqual(call.args.slice(0, 6),
    ['/d', '/s', '/c', 'start', '""', '/b'],
    'start is what creates a process cmd does not stay the parent of; /b keeps it out of a '
    + 'console window, /d and /s keep cmd from running AutoRun or re-parsing the quotes');
  assert.equal(call.args[6], process.execPath,
    'the server itself is still this Node, only reached through a launcher');
  assert.deepEqual(call.args.slice(8), ['ui', '--port', String(PORT), '--no-open'],
    'the breakaway may not change what the server is asked to be');
  assert.equal(call.options.detached, true,
    'the launcher still may not hold the hook open for the three seconds it is waited on');
  assert.equal(call.options.stdio, 'ignore',
    'the platform waits on a hook whose stdio a grandchild is holding');
  assert.equal(call.options.windowsHide, true, 'no console window may flash mid-turn');
  assert.equal(spawner.unrefs, 1, 'detached without unref keeps the parent alive anyway');
});

test(
  'a child launched the breakaway way outlives the exact kill the platform uses, and the old shape does not',
  {
    skip: process.platform !== 'win32'
      ? 'Windows-only: taskkill /T is the Windows reaper this proof is about'
      : false,
  },
  async () => {
    // Two parents, one launched each way, each with a long-lived child; then
    // the command Claude Code's hook watchdog runs on a timeout, read off
    // build 2.1.261 (`taskkill.exe /PID <pid> /T /F`). The OLD shape is run
    // beside the new one on purpose: without it the survival below proves only
    // that this machine did not happen to kill anything.
    //
    // **Both shapes are taken from what `upkeepUiServer` ACTUALLY EMITS**, not
    // written out again here. A copy of the launch line in a test file is a
    // second place for the launch line to live, and this whole item exists
    // because a conclusion was drawn from a record written downstream of the
    // thing it described. Only the tail — the server argv — is swapped for a
    // sleeper, because a test may not start a real UI server on the owner's
    // port. So a production change that drops `/b`, or the `cmd.exe` launcher
    // altogether, turns the survival assertion below red.
    const base = mkdtempSync(path.join(tmpdir(), 'uibreakaway-'));
    bases.push(base);
    const sleeper = path.join(base, 'sleeper.mjs');
    writeFileSync(sleeper,
      'import { writeFileSync } from "node:fs";\n'
      + 'writeFileSync(process.argv[2], String(process.pid));\n'
      + 'setInterval(() => {}, 1000);\n');

    /** What production emits for one platform, with the server argv removed. */
    const launchPrefix = async (
      platform: NodeJS.Platform,
    ): Promise<{ command: string; prefix: string[]; options: Record<string, unknown> }> => {
      const sb = sandbox();
      const spawner = fakeSpawn();
      await upkeepUiServer(sb.root, CONFIGURED, NOW, {
        globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
        platform,
      });
      const call = spawner.calls[0]!;
      // `serverArgv` is five entries — the CLI entry plus `ui --port N
      // --no-open` — and it is always the tail, on either shape.
      return { command: call.command, prefix: call.args.slice(0, -5), options: call.options };
    };

    const shapes = {
      old: await launchPrefix('linux'), // what the hook did before this change
      breakaway: await launchPrefix('win32'), // what it does now
    };

    const parentSource = (
      shape: { command: string; prefix: string[]; options: Record<string, unknown> },
    ): string =>
      'import { spawn } from "node:child_process";\n'
      + 'import { writeFileSync } from "node:fs";\n'
      // Its OWN pid first, before the spawn: a shape that fails to launch
      // anything must still leave a pid this test can reap, or a broken
      // production line would leak a process that runs until the machine is
      // rebooted. That is not hypothetical — it happened while this test was
      // being written.
      + 'writeFileSync(process.argv[2], String(process.pid));\n'
      + `const c = spawn(${JSON.stringify(shape.command)}, `
      + `[...${JSON.stringify(shape.prefix)}, ${JSON.stringify(sleeper)}, process.argv[3]], `
      + `${JSON.stringify(shape.options)});\n`
      + 'c.on("error", () => {});\n'
      + 'c.unref();\n'
      + 'setInterval(() => {}, 1000);\n';

    const alive = (pid: number): boolean => {
      try { process.kill(pid, 0); return true; } catch { return false; }
    };
    const TASKKILL = path.join(
      process.env.SYSTEMROOT ?? 'C:\\Windows', 'System32', 'taskkill.exe');
    // `RULE-a-delegated-worker-never-runs-a-command-that-reaches-beyond`: every
    // pid this reaches is one this test created and wrote down itself.
    const reap = (pid: number): void => {
      try {
        execFileSync(TASKKILL, ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } catch { /* already gone, which is the goal state */ }
    };
    const readPidWhenWritten = async (file: string): Promise<number> => {
      for (let i = 0; i < 120; i += 1) {
        try { return Number(readFileSync(file, 'utf8')); } catch { /* not yet */ }
        await new Promise((r) => { setTimeout(r, 50); });
      }
      throw new Error(`nothing ever wrote ${file}`);
    };

    const outcome: Record<string, { parent: boolean; child: boolean }> = {};
    for (const [name, shape] of Object.entries(shapes)) {
      const parentFile = path.join(base, `${name}-parent.mjs`);
      const parentPidFile = path.join(base, `${name}-parent.pid`);
      const childPidFile = path.join(base, `${name}-child.pid`);
      writeFileSync(parentFile, parentSource(shape));
      const launched = realSpawn(
        process.execPath, [parentFile, parentPidFile, childPidFile], { stdio: 'ignore' });
      const parentPid = await readPidWhenWritten(parentPidFile);
      let childPid: number | null = null;
      try {
        childPid = await readPidWhenWritten(childPidFile);
        assert.ok(alive(childPid), `${name}: the child never came up at all`);

        // The command Claude Code's hook watchdog runs on a timeout.
        execFileSync(TASKKILL, ['/PID', String(parentPid), '/T', '/F'], { stdio: 'ignore' });
        await new Promise((r) => { setTimeout(r, 1500); });
        outcome[name] = { parent: alive(parentPid), child: alive(childPid) };
      } finally {
        // In a `finally`, because an assertion that throws above must not leave
        // a never-exiting process behind — and a leaked one holds `node:test`
        // open for as long as it lives.
        if (childPid !== null) reap(childPid);
        reap(parentPid);
        launched.unref();
      }
    }

    assert.equal(outcome.old!.child, false,
      'the shape this change replaced must still die with its parent — if it survives, this '
      + 'machine is not reaping and the survival below proves nothing');
    assert.equal(outcome.breakaway!.child, true,
      'a server launched through a parent that exits must outlive `taskkill /T` on the hook — '
      + 'this is the whole of the defect that took the owner\'s server down on 2026-09-12');
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
  assert.deepEqual(gave, { did: 'stood-down', why: 'spawn', failures: MAX_CONSECUTIVE_SPAWN_FAILURES });
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
/* ---------------------------------------------------------------------------
 * A server that answers and is nonetheless WRONG.
 *
 * **This section is the 2026-09-02 defect.** The running server started at
 * 16:12:39; the last commit to its own modules landed at 16:28:26, sixteen
 * minutes LATER; and this mechanism, probing it every single minute, left it
 * alone every single time. `PROBE_FLOOR_MS` bounds how often the question "is
 * something listening" is asked and `SPAWN_INTERVAL_MS` bounds what is done
 * when nothing is — and neither of them, and nothing else in the module, ever
 * asked whether what answered was the code on disk. The owner restarted Claude
 * Code and was served the old modules; the web page's own code-skew banner had
 * been saying so, to a tab nobody had open.
 *
 * The answer was already being SERVED the whole time: `staleCode` on
 * `/api/meta`, off the one `CodeIdentity` the server stamps at startup. So
 * nothing here derives freshness — every test below hands the upkeep the answer
 * a server would have given, which is exactly the seam production uses.
 * ------------------------------------------------------------------------- */

/** A server's answer about its own code, and a record of having been asked. */
interface FakeFreshness {
  /** The URLs the question was put to, in order. One entry per ask. */
  asks: string[];
  fn: (url: string) => Promise<Freshness>;
}

function answering(answer: Freshness): FakeFreshness {
  const fake: FakeFreshness = { asks: [], fn: null as unknown as FakeFreshness['fn'] };
  fake.fn = async (url: string): Promise<Freshness> => {
    fake.asks.push(url);
    return answer;
  };
  return fake;
}

/**
 * A stand-in for `process.kill`, and it is not optional in any test that can
 * reach the restart path.
 *
 * The real one would signal whatever pid the liveness record names, and this
 * suite writes records naming `process.pid` and `process.ppid` — the process
 * running the tests and the one that started it. `stopServer` refuses its own
 * pid on top of this, but a guard and a seam are two different protections and
 * the one that keeps the suite alive is this one.
 */
interface FakeKill {
  signalled: { pid: number; signal: string }[];
  fn: (pid: number, signal: NodeJS.Signals) => void;
}

function fakeKill(): FakeKill {
  const fake: FakeKill = { signalled: [], fn: null as unknown as FakeKill['fn'] };
  fake.fn = (pid: number, signal: NodeJS.Signals): void => {
    fake.signalled.push({ pid, signal });
  };
  return fake;
}

test('a server that answers and reports itself FRESH is left alone', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const kill = fakeKill();
  const fresh = answering('fresh');
  const close = await serverAt(sb.globalRoot);
  try {
    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, NOW, {
        globalRoot: sb.globalRoot,
        spawnFn: spawner.fn,
        portAcceptsFn: NOTHING_ON_THE_PORT,
        freshnessFn: fresh.fn,
        killFn: kill.fn,
      }),
      { did: 'nothing', why: 'alive' },
    );
    assert.equal(fresh.asks.length, 1, 'the question was not put to a server that could answer it');
    assert.equal(spawner.calls.length, 0,
      'a server that is current was replaced anyway — a restart nobody needed is an outage ' +
      'bought for nothing, and this path rides every assistant turn');
    assert.equal(kill.signalled.length, 0);
    assert.equal(stateOf(sb.root)['lastOutcome'], 'alive');
  } finally {
    await close();
  }
});

test('a server that answers and reports itself STALE is stopped and started again', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const kill = fakeKill();
  const stale = answering('stale');
  // `process.ppid` and not `process.pid`: the record has to name a LIVE process
  // — `probeUiServer` disproves a dead pid before it ever reaches the port — and
  // it must not name this one, or `stopServer`'s self-guard would answer the
  // question this test is asking. Nothing is actually signalled; `kill.fn` is.
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, NOW, {
        globalRoot: sb.globalRoot,
        spawnFn: spawner.fn,
        portAcceptsFn: REPLACEMENT_COMES_UP,
        freshnessFn: stale.fn,
        killFn: kill.fn,
      }),
      { did: 'restarted', port: PORT },
      'a server that answered a probe and then told the mechanism its own modules were behind ' +
      'the disk was left running — which is the whole defect: liveness was the only question ' +
      'ever asked, and the answer to the other one was already being served',
    );
    assert.deepEqual(kill.signalled, [{ pid: process.ppid, signal: 'SIGTERM' }],
      'the stale server was not stopped, so the spawn on the next line can only ever answer ' +
      'EADDRINUSE — the port is held by the process being replaced');
    assert.equal(spawner.calls.length, 1);
    // The TAIL of the argv, not `slice(1)`: on Windows the same server argv is
    // reached through a `cmd.exe` launcher (see the breakaway tests above), and
    // the claim this assertion makes — that a restart starts the same thing a
    // cold spawn does — is about the server, not about how it is reached.
    assert.deepEqual(spawner.calls[0].args.slice(-4),
      ['ui', '--port', String(PORT), '--no-open'],
      'the replacement is not the same command the cold spawn starts');
  } finally {
    await close();
  }
});

test('a restart is not recorded as a spawn — the log can tell them apart', async () => {
  const restarted = sandbox();
  const cold = sandbox();
  const spawner = fakeSpawn();
  const kill = fakeKill();
  const close = await serverAt(restarted.globalRoot, process.ppid);
  try {
    await upkeepUiServer(restarted.root, CONFIGURED, NOW, {
      globalRoot: restarted.globalRoot,
      spawnFn: spawner.fn,
      portAcceptsFn: REPLACEMENT_COMES_UP,
      freshnessFn: answering('stale').fn,
      killFn: kill.fn,
    });
  } finally {
    await close();
  }
  await upkeepUiServer(cold.root, CONFIGURED, NOW,
    { globalRoot: cold.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT });

  assert.equal(stateOf(restarted.root)['lastOutcome'], 'restarted-stale');
  assert.equal(stateOf(cold.root)['lastOutcome'], 'spawned',
    'a server that was answering and was replaced, and a port where nothing was answering at ' +
    'all, wrote the same word — and a restart that looks identical to a spawn in the log is a ' +
    'restart nobody can explain later');
});

test('a freshness question that went unanswered is not read as a skew', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const kill = fakeKill();
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, NOW, {
        globalRoot: sb.globalRoot,
        spawnFn: spawner.fn,
        portAcceptsFn: NOTHING_ON_THE_PORT,
        freshnessFn: answering('unknown').fn,
        killFn: kill.fn,
      }),
      { did: 'nothing', why: 'alive' },
      'a question that could not be answered was treated as a yes — a refused connection, a ' +
      'timeout and a body that would not parse are not evidence of anything, and restarting ' +
      'on one buys a new outage to disclose an old one',
    );
    assert.equal(spawner.calls.length, 0);
    assert.equal(kill.signalled.length, 0);
  } finally {
    await close();
  }
});

test('the question is put to the address the probe PROVED, not to the configured port', async () => {
  const sb = sandbox();
  const asked = answering('fresh');
  // The record's port is ephemeral and is deliberately NOT `config.ui.port` —
  // this module does not compare the two, and asking one server about another
  // server's code would be worse than not asking at all.
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot,
      spawnFn: fakeSpawn().fn,
      portAcceptsFn: NOTHING_ON_THE_PORT,
      freshnessFn: asked.fn,
      killFn: fakeKill().fn,
    });
    assert.equal(asked.asks.length, 1);
    assert.doesNotMatch(asked.asks[0] as string, new RegExp(String(PORT), 'u'),
      'the freshness question went to the CONFIGURED port rather than to the server the probe ' +
      'had just proved answers — the record and the config can name different ports, and this ' +
      'module says so in as many words');
  } finally {
    await close();
  }
});

test('the credential exchange is floored, so it does not run on every probe', async () => {
  const sb = sandbox();
  const asked = answering('fresh');
  const deps = {
    globalRoot: sb.globalRoot,
    spawnFn: fakeSpawn().fn,
    portAcceptsFn: NOTHING_ON_THE_PORT,
    freshnessFn: asked.fn,
    killFn: fakeKill().fn,
  };
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    await upkeepUiServer(sb.root, CONFIGURED, NOW, deps);
    assert.equal(asked.asks.length, 1);

    await upkeepUiServer(sb.root, CONFIGURED, NOW + PROBE_FLOOR_MS + 1_000, deps);
    assert.equal(asked.asks.length, 1,
      'the ask ran again a minute later. Its first step MINTS A CREDENTIAL and writes an audit ' +
      'row for it, so an unfloored ask is sixty security records an hour in a corpus 5,207 ' +
      'rows of per-message noise were once deleted from');

    await upkeepUiServer(sb.root, CONFIGURED, NOW + SPAWN_INTERVAL_MS + 1_000, deps);
    assert.equal(asked.asks.length, 2,
      'the ask never came round again — a floor that never lifts is the mechanism switched off');
  } finally {
    await close();
  }
});

test('a stale restart is refused by the SPAWN floor, exactly as a cold spawn is', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const stale = answering('stale');
  const deps = {
    globalRoot: sb.globalRoot,
    spawnFn: spawner.fn,
    portAcceptsFn: REPLACEMENT_COMES_UP,
    freshnessFn: stale.fn,
    killFn: fakeKill().fn,
  };
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    assert.equal((await upkeepUiServer(sb.root, CONFIGURED, NOW, deps)).did, 'restarted');
    assert.equal(spawner.calls.length, 1);

    // The ask's floor and the spawn's floor are two clocks. Rewinding only the
    // ask's makes the question due while the spawn is not, which is the one
    // arrangement in which the SPAWN floor is what refuses — a test that let
    // both floors refuse together could not say which one did.
    writeFileSync(upkeepStatePath(sb.root), JSON.stringify({
      ...stateOf(sb.root), lastFreshnessAt: NOW - SPAWN_INTERVAL_MS - 1,
    }), 'utf8');

    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, NOW + PROBE_FLOOR_MS + 1_000, deps),
      { did: 'nothing', why: 'too-soon' },
    );
    assert.equal(spawner.calls.length, 1,
      'a stale server was replaced inside the 5-minute spawn floor. A restart IS a spawn — it ' +
      'starts a process against the configured port — and a bad server is still a server: ' +
      'replacing one every minute is the storm the floor exists to prevent');
  } finally {
    await close();
  }
});

test('three restarts that leave it stale stand the mechanism down', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const deps = {
    globalRoot: sb.globalRoot,
    spawnFn: spawner.fn,
    portAcceptsFn: REPLACEMENT_COMES_UP,
    freshnessFn: answering('stale').fn,
    killFn: fakeKill().fn,
  };
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    let at = NOW;
    for (let i = 0; i < MAX_CONSECUTIVE_SPAWN_FAILURES; i += 1) {
      assert.equal((await upkeepUiServer(sb.root, CONFIGURED, at, deps)).did, 'restarted');
      at += SPAWN_INTERVAL_MS + 1_000;
    }
    assert.equal(spawner.calls.length, MAX_CONSECUTIVE_SPAWN_FAILURES);

    assert.deepEqual(await upkeepUiServer(sb.root, CONFIGURED, at, deps),
      { did: 'stood-down', why: 'stale', failures: MAX_CONSECUTIVE_SPAWN_FAILURES },
      'a stale server that cannot be replaced was replaced again, and again, forever — the ' +
      'stand-down is what turns a refusal into a state instead of a loop');
    assert.equal(stateOf(sb.root)['lastOutcome'], 'stood-down-stale',
      'the two stand-downs make opposite claims — one that nothing would start, one that ' +
      'something is serving and will not be replaced — and a reader who cannot tell them ' +
      'apart goes looking for an outage that is not happening');

    at += SPAWN_INTERVAL_MS + 1_000;
    assert.deepEqual(await upkeepUiServer(sb.root, CONFIGURED, at, deps),
      { did: 'nothing', why: 'stood-down' });
    assert.equal(spawner.calls.length, MAX_CONSECUTIVE_SPAWN_FAILURES,
      'a stood-down workspace restarted a stale server. The probe is what was un-gated; ' +
      'starting a process is the thing the refusal exists to prevent');
  } finally {
    await close();
  }
});

test('a server that comes back FRESH clears the restarts counted against it', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const base = {
    globalRoot: sb.globalRoot,
    spawnFn: spawner.fn,
    portAcceptsFn: NOTHING_ON_THE_PORT,
      sleepFn: NO_WAITING,
    killFn: fakeKill().fn,
  };
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    let at = NOW;
    // Two restarts that did not take: one short of standing down.
    for (let i = 0; i < MAX_CONSECUTIVE_SPAWN_FAILURES - 1; i += 1) {
      await upkeepUiServer(sb.root, CONFIGURED, at, { ...base, freshnessFn: answering('stale').fn });
      at += SPAWN_INTERVAL_MS + 1_000;
    }
    assert.equal(stateOf(sb.root)['consecutiveSpawnFailures'], MAX_CONSECUTIVE_SPAWN_FAILURES - 2);

    await upkeepUiServer(sb.root, CONFIGURED, at, { ...base, freshnessFn: answering('fresh').fn });
    assert.equal(stateOf(sb.root)['consecutiveSpawnFailures'], 0,
      'a restart that plainly worked did not clear the ones that did not — the counter would ' +
      'then reach three across restarts with a healthy server between them');
    assert.equal(stateOf(sb.root)['lastOutcome'], 'alive');
  } finally {
    await close();
  }
});

test('the upkeep never signals the process it is running in', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const kill = fakeKill();
  // The record names THIS process, which is what every fixture in this file
  // wrote before the upkeep could signal anything. `stopServer` refuses it.
  const close = await serverAt(sb.globalRoot, process.pid);
  try {
    assert.deepEqual(
      await upkeepUiServer(sb.root, CONFIGURED, NOW, {
        globalRoot: sb.globalRoot,
        spawnFn: spawner.fn,
        portAcceptsFn: REPLACEMENT_COMES_UP,
        freshnessFn: answering('stale').fn,
        killFn: kill.fn,
      }),
      { did: 'restarted', port: PORT },
    );
    assert.deepEqual(kill.signalled, [],
      'the upkeep signalled its own pid. Every other mistake in that module is undone by the ' +
      'next probe; this one takes down the process the platform is waiting on');
  } finally {
    await close();
  }
});

test('the stale stand-down line does not claim nothing was serving', () => {
  const root = path.join('X', '.my_context');
  const stale = upkeepStandDownLine(MAX_CONSECUTIVE_SPAWN_FAILURES, root, 'stale');
  assert.match(stale, /kept answering/u);
  assert.doesNotMatch(stale, /not answering on any of those attempts/u,
    '"the configured port was not answering" was said about a server that was answering the ' +
    'whole time — the exact reading that reported a two-hour outage which had not happened, ' +
    'this time printed by the product itself');
  assert.match(stale, /ui-server-upkeep\.json/u,
    'the way out of a refusal has to be named whichever refusal it is');

  const spawn = upkeepStandDownLine(MAX_CONSECUTIVE_SPAWN_FAILURES, root, 'spawn');
  assert.match(spawn, /not answering/u);
  assert.notEqual(stale, spawn,
    'two opposite causes said the same sentence, which is the defect one layer up wearing the ' +
    'disclosure as a hat');
  assert.equal(upkeepStandDownLine(MAX_CONSECUTIVE_SPAWN_FAILURES, root), spawn,
    'the default changed the sentence every existing caller was getting');
});

test('the replacement is started in the workspace the old server named', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  // A directory that EXISTS, because `startServer` refuses to hand `spawn` a
  // `cwd` that is not there — `spawn` rejects an absent one outright, and a
  // restart that can never succeed is worse than one that lands somewhere the
  // caller can see.
  const close = await serverAt(sb.globalRoot, process.ppid, tmpdir());
  try {
    await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot,
      spawnFn: spawner.fn,
      portAcceptsFn: REPLACEMENT_COMES_UP,
      freshnessFn: answering('stale').fn,
      killFn: fakeKill().fn,
    });
    assert.equal(spawner.calls.length, 1);
    assert.equal(spawner.calls[0].options.cwd, tmpdir(),
      'the replacement inherited the HOOK\'s working directory instead of the one the server ' +
      'it replaced named for itself. A UI server serves the corpus its cwd resolves to: ' +
      'measured 2026-09-02, a restart came back serving 44 items where the server it replaced ' +
      'had been serving 760, answering every question correctly about the wrong repository');
  } finally {
    await close();
  }
});

test('a workspace that is no longer there is not passed to spawn', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const close = await serverAt(sb.globalRoot, process.ppid, path.join('D:', 'gone-a-year-ago'));
  try {
    await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot,
      spawnFn: spawner.fn,
      portAcceptsFn: NOTHING_ON_THE_PORT,
      sleepFn: NO_WAITING,
      freshnessFn: answering('stale').fn,
      killFn: fakeKill().fn,
    });
    // The absent KEY, not the whole options object: the object also carries
    // the launch shape, which differs by platform (see the breakaway tests
    // above) and is not what this test is about.
    assert.ok(!('cwd' in spawner.calls[0].options),
      'a cwd that does not exist was handed to spawn, which refuses it — so the restart could ' +
      'never succeed, and it would fail the same way on every attempt until the stand-down');
  } finally {
    await close();
  }
});

/* ---------------------------------------------------------------------------
 * `plan:governance seq:4` — A DISCARDED STATE WRITE IS COUNTED, AND LEAVES
 * NOTHING BEHIND.
 *
 * `writeState` writes `<target>.tmp-<pid>` and renames it, inside a try/catch
 * that discards failures on purpose — a lost clock costs one extra spawn
 * attempt and the floor is restored by the next write that lands. THAT DESIGN
 * IS NOT WHAT THESE TESTS DISPUTE and nothing below asks the write to be
 * retried, awaited or thrown.
 *
 * What they hold is the two things the item found wrong with the SILENCE:
 * nothing counted the failures, and the temp file was left where it fell —
 * measured 2026-09-06 as nine orphans, every pid dead, the oldest three days
 * old, all of them 209-224 bytes, which is a complete state document and
 * therefore a failed RENAME rather than a failed write.
 *
 * **The fixture reproduces exactly that failure**: a DIRECTORY where the state
 * file goes. The temp write succeeds and the rename cannot, on every platform,
 * without a permission bit that Windows would ignore.
 * ------------------------------------------------------------------------- */

/** Makes the state file unwritable-over by putting a directory in its place. */
function blockTheStateFile(sb: Sandbox): void {
  mkdirSync(upkeepStatePath(sb.root), { recursive: true });
}

/** Every `ui-server-upkeep.json.tmp-*` left in the state directory. */
function orphanTemps(sb: Sandbox): string[] {
  return readdirSync(sb.stateDir).filter((name) => name.includes('.tmp-'));
}

test('a discarded state write is REPORTED, and the act it belongs to still happened', async () => {
  const sb = sandbox();
  blockTheStateFile(sb);
  const spawner = fakeSpawn();

  const result = await upkeepUiServer(sb.root, CONFIGURED, NOW, {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  });

  // The act is unchanged — a server really was started — and the flag says only
  // that the RECORD of it was lost. A discard that suppressed the spawn would be
  // a different and much worse change than the one this item asked for.
  assert.equal(result.did, 'spawned');
  assert.equal(spawner.calls.length, 1, 'the spawn was skipped because a write failed');
  assert.equal(result.stateWriteDiscarded, true,
    'the write was discarded and the result said nothing about it, which is the whole defect: ' +
    'a rate nobody can read looks exactly like a mechanism that is healthy');
});

test('the temp file a discarded write leaves is UNLINKED, so nothing accumulates', async () => {
  const sb = sandbox();
  blockTheStateFile(sb);
  const spawner = fakeSpawn();

  for (let i = 0; i < 3; i += 1) {
    // Three probe intervals apart, so each call genuinely reaches a write rather
    // than being refused by the probe floor. Each one fails the same way.
    const at = NOW + i * (PROBE_FLOOR_MS + 1_000);
    const result = await upkeepUiServer(sb.root, CONFIGURED, at, {
      globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
    });
    assert.equal(result.stateWriteDiscarded, true, `call ${i} did not report its discard`);
  }

  assert.deepEqual(orphanTemps(sb), [],
    'a failed write left its temp file behind. Three days of that produced nine orphans and ' +
    'no other trace of anything being wrong, which is the litter half of this item');
});

test('a write that LANDS reports nothing, and leaves no temp file either', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const result = await upkeepUiServer(sb.root, CONFIGURED, NOW, {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  });

  assert.deepEqual(result, { did: 'spawned', port: PORT },
    'the ordinary path grew a field. Absence is what says the write landed, and every reader ' +
    'of this result — including three existing assertions in this file — reads it that way');
  assert.equal(Object.hasOwn(result, 'stateWriteDiscarded'), false);
  assert.deepEqual(orphanTemps(sb), []);
  // And the state really is on disk, which is what makes the assertion above a
  // statement about the write rather than about the flag.
  assert.equal(
    (JSON.parse(readFileSync(upkeepStatePath(sb.root), 'utf8')) as { lastOutcome: string })
      .lastOutcome,
    'spawned');
});

test('a discard on a QUIET turn is reported too — the common case, and the one that counts', async () => {
  const sb = sandbox();
  blockTheStateFile(sb);
  const close = await serverAt(sb.globalRoot);
  try {
    // A server is answering, so the call does nothing at all except record that
    // it looked. Those turns are almost all of them, and a report that only rode
    // along with a spawn would miss nearly every failure there is.
    const result = await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot, spawnFn: fakeSpawn().fn, portAcceptsFn: NOTHING_ON_THE_PORT,
      freshnessFn: async () => 'fresh',
    });
    assert.equal(result.did, 'nothing');
    assert.equal(result.stateWriteDiscarded, true);
    assert.deepEqual(orphanTemps(sb), []);
  } finally {
    await close();
  }
});

/* ---------------------------------------------------------------------------
 * NEVER STOP A SERVER YOU CANNOT REPLACE.
 *
 * The declaration for this section is the file's own, at the top.
 *
 * **Measured on the owner's own machine, 2026-09-11.** The audit log holds five
 * `stop` rows between 22:35:12Z and 23:14:24Z, each one saying the UI server on
 * 58888 *"reported its own code stale, so it was stopped and started again"* —
 * and at 23:18Z nothing was listening on 58888 and no liveness record existed
 * at all. The working tree held thirteen modified files, `src/ui/server.ts` and
 * `src/ui/public/` among them, so `staleCode` was permanently true and every
 * turn boundary past the spawn floor reached this branch.
 *
 * `restartStaleServer` stopped the server and started the replacement, and the
 * call ended there. **Nothing in it ever learned whether the replacement bound
 * the port**, and nothing could: `startServer` documents that a pid says libuv
 * accepted the exec and nothing more. When the replacement did not come up the
 * owner had no server, the next attempt was five minutes away by the spawn
 * floor, and it would only happen if some session fired another `Stop` hook —
 * which, with the owner asleep, is a condition nothing in this product controls.
 *
 * Everything below asserts the same property from a different side: **the call
 * that stops a server does not return until it has measured whether one is
 * listening, and it never leaves the owner behind a five-minute floor when the
 * answer was no.**
 * ------------------------------------------------------------------------- */

test('a replacement that never comes up is MEASURED, not assumed', async () => {
  const sb = sandbox();
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    const result = await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot,
      spawnFn: fakeSpawn().fn,
      // Nothing ever answers on the configured port: the replacement was
      // started and did not bind. A spawn that dies leaves no trace anywhere
      // else — this is the only moment the mechanism can find out.
      portAcceptsFn: NOTHING_ON_THE_PORT,
      freshnessFn: answering('stale').fn,
      killFn: fakeKill().fn,
      sleepFn: NO_WAITING,
    });
    assert.equal((result as { replacementUnconfirmed?: true }).replacementUnconfirmed, true,
      'the upkeep stopped a server and reported a restart without ever asking whether anything '
      + 'was listening afterwards. A pid says libuv accepted the exec; the owner needs a socket, '
      + 'and on 2026-09-11 he was left with neither and no record that anything was wrong');
  } finally {
    await close();
  }
});

test('a replacement that never comes up is started ONCE MORE before the call gives up', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot,
      spawnFn: spawner.fn,
      portAcceptsFn: NOTHING_ON_THE_PORT,
      freshnessFn: answering('stale').fn,
      killFn: fakeKill().fn,
      sleepFn: NO_WAITING,
    });
    assert.equal(spawner.calls.length, 2,
      'the port was given up and exactly one attempt was made to fill it. The commonest reason '
      + 'a replacement does not bind is the socket the process just killed not yet being '
      + 'released, which is over in milliseconds — and the call that created the hole is the '
      + 'cheapest place there will ever be to try again');
  } finally {
    await close();
  }
});

test('a restart whose replacement never came up does NOT hold the five-minute floor', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  const deps = {
    globalRoot: sb.globalRoot,
    spawnFn: spawner.fn,
    portAcceptsFn: NOTHING_ON_THE_PORT,
    freshnessFn: answering('stale').fn,
    killFn: fakeKill().fn,
    sleepFn: NO_WAITING,
  };
  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    await upkeepUiServer(sb.root, CONFIGURED, NOW, deps);
  } finally {
    // The record now points at a port nothing is on, exactly as it did on the
    // owner's machine: the server was stopped and the replacement never bound.
    await close();
  }

  // One PROBE interval later — a minute, not five. The spawn floor exists to
  // stop a bad server being replaced every minute; there is no server here.
  assert.equal(
    (await upkeepUiServer(sb.root, CONFIGURED, NOW + PROBE_FLOOR_MS + 1_000, deps)).did,
    'spawned',
    'the owner was left with nothing and the mechanism waited out a floor whose whole argument '
    + 'is that a stale server is still a server. It was not still a server — the call before '
    + 'this one had just measured that nothing was listening');
});

test('two hooks racing to replace ONE server stop it once, not twice', async () => {
  const sb = sandbox();
  const other = sandbox();
  const kill = fakeKill();
  let nextPid = 90_001;
  // A replacement that behaves like a real one: it takes the port and RECORDS
  // ITSELF, which is the only way a second hook can tell that the server it
  // probed a moment ago is not the server on the port now.
  const spawnFn = ((): unknown => {
    const current = readUiServerRecord(sb.globalRoot);
    nextPid += 1;
    if (current !== null) writeUiServerRecord({ ...current, pid: nextPid }, sb.globalRoot);
    const child = new EventEmitter() as FakeChild;
    child.pid = nextPid;
    child.unref = (): void => {};
    return child;
  }) as unknown as typeof spawn;

  // The barrier is the freshness ask itself, and that is where the window
  // really is: `askServerFreshness` is a THREE-REQUEST credential exchange, so
  // between the probe that proved a pid and the signal sent to it there are
  // three round trips in which another hook can replace the whole server.
  let arrived = 0;
  let release = (): void => {};
  const bothArrived = new Promise<void>((resolve) => { release = resolve; });
  const freshnessFn = async (): Promise<Freshness> => {
    arrived += 1;
    if (arrived === 2) release();
    await bothArrived;
    return 'stale';
  };

  const close = await serverAt(sb.globalRoot, process.ppid);
  try {
    const deps = {
      globalRoot: sb.globalRoot,
      spawnFn,
      portAcceptsFn: REPLACEMENT_COMES_UP,
      freshnessFn,
      killFn: kill.fn,
      sleepFn: NO_WAITING,
    };
    // Two workspaces, because the state file is per workspace and this hazard
    // is not about the clocks — it is about two processes signalling one pid.
    await Promise.all([
      upkeepUiServer(sb.root, CONFIGURED, NOW, deps),
      upkeepUiServer(other.root, CONFIGURED, NOW, deps),
    ]);
    assert.deepEqual(kill.signalled, [{ pid: process.ppid, signal: 'SIGTERM' }],
      'both hooks signalled, and the second one signalled a pid it had proved alive before a '
      + 'three-request exchange it then waited through. Tonight that second signal lands on the '
      + 'replacement the first hook had just started — a server killed seconds after it bound, '
      + 'by a hook that believed it was killing the stale one');
  } finally {
    await close();
  }
});

test('a stale stand-down never stops an ABSENT server being put back', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  // The state a stale stand-down leaves: the mechanism has refused to REPLACE a
  // server three times. It has never said a server could not be STARTED — the
  // stand-down line says so in as many words, and the two causes are separate
  // values in the file for exactly that reason.
  writeFileSync(upkeepStatePath(sb.root), JSON.stringify({
    lastProbeAt: NOW - PROBE_FLOOR_MS - 1,
    lastSpawnAt: NOW - SPAWN_INTERVAL_MS - 1,
    spawnPending: false,
    consecutiveSpawnFailures: MAX_CONSECUTIVE_SPAWN_FAILURES,
    stoodDown: true,
    stoodDownWhy: 'stale',
    lastFreshnessAt: NOW - SPAWN_INTERVAL_MS - 1,
    lastOutcome: 'stood-down-stale',
  }), 'utf8');

  // No record and nothing on the port: the server the stand-down was declared
  // over is gone. Every claim the refusal rests on is now false.
  assert.equal(
    (await upkeepUiServer(sb.root, CONFIGURED, NOW, {
      globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
    })).did,
    'spawned',
    'a refusal that meant "something is serving and will not be replaced" was read as "no '
    + 'server will be started", and the owner was left with nothing until a person deleted a '
    + 'state file. The two stand-downs make opposite claims and this is the one that matters');
});
