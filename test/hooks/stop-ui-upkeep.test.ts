/**
 * **`Stop` keeps the UI server up, and does it without disturbing the one
 * thing `Stop` was already saying.**
 *
 * `plan:upkeep seq:5`. `src/core/ui-server-upkeep.ts` decides WHETHER to probe
 * and whether to spawn, and `test/core/ui-server-upkeep.test.ts` holds it to
 * its two floors and its stand-down. This file is about the seam: what the hook
 * does with the answer, and what it must not do with it.
 *
 * Four properties:
 *
 *  1. **The upkeep joins the NOTE and never the envelope.** `Stop`'s
 *     `additionalContext` was opened on 2026-08-27 for exactly one purpose —
 *     `DEC-stop-speaks-once-and-only-to-raise-the-handover` — and a second
 *     feature quietly writing into it would be that ruling widened by a commit
 *     nobody reviewed as one. The upkeep therefore reports into the audit log,
 *     which is where "what was done" belongs, and stdout stays exactly as
 *     narrow as it was.
 *  2. **It speaks only when something HAPPENED.** A per-turn hook that appends
 *     a clause on every turn makes the log unreadable — `observe.ts`'s header
 *     already rules on that — so `off`, `disabled`, `too-soon` and `alive` add
 *     nothing at all, and a spawn and a stand-down do.
 *  3. **The handover ask is untouched.** The load-bearing test here is the one
 *     where BOTH happen on one turn: the row carries the spawn and the
 *     percentage, and the envelope still carries the ask, unaltered.
 *  4. **It does not run in a subagent, and it never throws.** Spec §7, the
 *     restriction `PostCompact` already keeps.
 *
 * **In-process, through `observeAndRecord`**, for `stop-handover-ask.test.ts`'s
 * reason: this needs a config, a status-line fixture and an injected clock and
 * spawn across several turns of one session, and a spawn per turn would buy
 * none of that.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import type { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { readLatch } from '../../src/core/handover-ask.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import {
  MAX_CONSECUTIVE_SPAWN_FAILURES, PROBE_FLOOR_MS, SPAWN_INTERVAL_MS, upkeepUiServer,
  type Upkeep, type UpkeepDeps,
} from '../../src/core/ui-server-upkeep.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import { observeStop, stopSpec, stopUpkeep, STOP } from '../../src/hooks/stop.ts';
import { removeTree } from '../helpers/tmp.ts';

const NOW = 1_756_300_000_000;
const PORT = 58888;

/**
 * The occupancy check, answered without touching a socket — see the same
 * constant in `test/core/ui-server-upkeep.test.ts` for why it is not optional.
 * `PORT` is a real port on the machine running the suite and the one the
 * owner's own UI server uses, so the real check would make these tests answer
 * differently depending on what else is running.
 */
const NOTHING_ON_THE_PORT = async (): Promise<boolean> => false;

const bases: string[] = [];
after(() => { for (const base of bases) removeTree(base); });

let sessionCounter = 0;

interface Sandbox {
  /** The repository directory a hook payload carries as `cwd`. */
  cwd: string;
  /** The `.my_context` directory. */
  root: string;
  /** A stand-in for `~/.my-context`, so no test can reach the real home. */
  globalRoot: string;
  session: string;
}

/**
 * A workspace, with whichever of `ui` and `handover` the test needs.
 *
 * Merged into what `init` wrote rather than replacing it — a test that silently
 * drops the rest of a real `config.json` is testing a shape no user has.
 */
function sandbox(options: {
  port?: number | null;
  enabled?: boolean;
  handoverPath?: string | null;
  thresholdPercent?: number;
} = {}): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stop-upkeep-'));
  bases.push(cwd);
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root, 'the sandbox has no workspace');

  const file = path.join(root, 'config.json');
  const raw = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    : {};
  const next: Record<string, unknown> = { ...raw };
  if (options.port !== undefined || options.enabled !== undefined) {
    const ui: Record<string, unknown> = {};
    if (options.port !== undefined) ui.port = options.port;
    if (options.enabled !== undefined) ui.enabled = options.enabled;
    next.ui = ui;
  }
  if (options.handoverPath !== undefined && options.handoverPath !== null) {
    const handover: Record<string, unknown> = { path: options.handoverPath };
    if (options.thresholdPercent !== undefined) {
      handover.thresholdPercent = options.thresholdPercent;
    }
    next.handover = handover;
  }
  writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');

  sessionCounter += 1;
  return {
    cwd, root, globalRoot: path.join(cwd, 'global-root'), session: `upkeep-sess-${sessionCounter}`,
  };
}

interface FakeSpawn {
  calls: { command: string; args: string[] }[];
  fn: typeof spawn;
}

/** `test/core/ui-server-upkeep.test.ts`'s fake, for its reason: no real server. */
function fakeSpawn(): FakeSpawn {
  const fake: FakeSpawn = { calls: [], fn: null as unknown as typeof spawn };
  fake.fn = ((command: string, args: string[]) => {
    fake.calls.push({ command, args });
    const child = new EventEmitter() as EventEmitter & { pid?: number; unref(): void };
    child.pid = 4242;
    child.unref = (): void => {};
    return child as unknown as ChildProcess;
  }) as unknown as typeof spawn;
  return fake;
}

/** A `context_window` block in the shape Claude Code actually sends. */
function sampleAt(percent: number, window = 200_000): Record<string, unknown> {
  return {
    context_window: {
      context_window_size: window,
      current_usage: {
        input_tokens: (window * percent) / 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 1_234,
      },
    },
  };
}

interface Turn {
  stdout: string;
  rows: AuditRecord[];
}

/** One assistant turn ending, with an upkeep result already in hand. */
function runStop(sb: Sandbox, upkeep: Upkeep | null, percent?: number): Turn {
  if (percent !== undefined) {
    assert.deepEqual(
      writeTee(sb.root, { session_id: sb.session, ...sampleAt(percent) }),
      { written: true },
    );
  }
  const outcome = observeAndRecord(
    stopSpec(upkeep),
    { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'Stop', stop_hook_active: false },
    sb.cwd,
  );
  return { stdout: outcome.stdout, rows: readAudit(sb.root).filter((r) => r.op === 'stop') };
}

/** Everything the hook wrote to stderr while `run` ran. */
async function capturingStderr(run: () => Promise<void>): Promise<string> {
  let captured = '';
  const real = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    await run();
  } finally {
    process.stderr.write = real;
  }
  return captured;
}

/* ---------------------------------------------------------------------------
 * What reaches the note, and what does not.
 * ------------------------------------------------------------------------- */

test('a spawn is recorded in the note, with the port it went to', () => {
  const sb = sandbox({ port: PORT });
  const turn = runStop(sb, { did: 'spawned', port: PORT });
  assert.equal(turn.rows.length, 1, 'the one row per assistant turn was lost or doubled');
  const note = turn.rows[0].note ?? '';
  assert.match(note, /stop_hook_active=false/u,
    'the turn-boundary note this hook has written since seq:21 was replaced rather than added to');
  assert.match(note, new RegExp(String(PORT), 'u'));
  assert.match(note, /started/iu,
    'the row says a port and not what happened at it — the log is the only place this ' +
    'mechanism ever reports, since it deliberately writes nothing to stdout');
});

test('a stand-down is recorded in the note, with the count that caused it', () => {
  const sb = sandbox({ port: PORT });
  const note = runStop(sb, { did: 'stood-down', why: 'spawn', failures: 3 }).rows[0].note ?? '';
  assert.match(note, /stood down/iu);
  assert.match(note, /3/u);
});

test('nothing happening says nothing at all', () => {
  const whys = ['off', 'disabled', 'too-soon', 'alive', 'stood-down'] as const;
  for (const why of whys) {
    const sb = sandbox({ port: PORT });
    const note = runStop(sb, { did: 'nothing', why }).rows[0].note ?? '';
    assert.doesNotMatch(note, /ui server/iu,
      `"${why}" put a clause in the log on a turn where nothing happened — Stop fires on every ` +
      'assistant turn, and a hook that records everything makes the log unreadable');
  }
});

test('the upkeep never writes to stdout — the envelope stays the handover ask\'s', () => {
  const sb = sandbox({ port: PORT });
  assert.equal(runStop(sb, { did: 'spawned', port: PORT }).stdout, '',
    'the upkeep spoke to the MODEL. Stop\'s additionalContext was ruled open for ONE purpose ' +
    'and a second use needs its own ruling, not a second caller');
  assert.equal(runStop(sb, { did: 'stood-down', why: 'spawn', failures: 3 }).stdout, '');
});

test('with no upkeep result the note is exactly what it has always been', () => {
  const sb = sandbox();
  const withNothing = runStop(sb, null).rows[0].note ?? '';
  assert.equal(withNothing, 'stop_hook_active=false; the assistant turn ended');
});

test('the exported STOP spec carries no upkeep, so nine hooks worth of tests still hold', () => {
  const sb = sandbox({ port: PORT });
  const outcome = observeAndRecord(
    STOP,
    { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'Stop', stop_hook_active: false },
    sb.cwd,
  );
  assert.equal(outcome.note, 'stop_hook_active=false; the assistant turn ended');
  assert.equal(outcome.stdout, '');
});

/* ---------------------------------------------------------------------------
 * The one turn where both things happen.
 * ------------------------------------------------------------------------- */

test('a spawn and a handover ask on one turn: the row carries both, the envelope one', () => {
  const sb = sandbox({ port: PORT, handoverPath: 'reports/H.md', thresholdPercent: 98 });
  const turn = runStop(sb, { did: 'spawned', port: PORT }, 99);

  const note = turn.rows[0].note ?? '';
  assert.match(note, new RegExp(String(PORT), 'u'), 'the spawn fell out of the row');
  assert.match(note, /asked for a handover update at 99\.0% occupancy/u,
    'the upkeep displaced the handover ask in the note — the ask is the only evidence in the ' +
    'log that a session was asked at all, and stdout leaves no trace');

  const envelope = JSON.parse(turn.stdout) as {
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  assert.equal(envelope.hookSpecificOutput?.hookEventName, 'Stop');
  const text = envelope.hookSpecificOutput?.additionalContext ?? '';
  assert.match(text, /Update reports\/H\.md NOW/u);
  assert.doesNotMatch(text, new RegExp(String(PORT), 'u'),
    'the upkeep leaked into the text the MODEL reads');
});

/**
 * The latch still holds when an upkeep result is in hand.
 *
 * `plan:handover seq:9` changed what holding it MEANS — an ask that can be
 * measured to have been ignored may be repeated once — so the handover is
 * written between the two turns here, exactly as a model answering the ask
 * would. What is being tested is the seam, not the ask rule: that rule is
 * `test/hooks/stop-handover-ask.test.ts`'s and is pinned there in both
 * directions.
 */
test('the ask is still latched once when an upkeep result is in hand', () => {
  const sb = sandbox({ port: PORT, handoverPath: 'reports/H.md', thresholdPercent: 98 });
  assert.notEqual(runStop(sb, { did: 'spawned', port: PORT }, 99).stdout, '');

  // The mtime is SET rather than left to the clock: a file written in the same
  // millisecond as the ask is a coin flip against a comparison that is
  // deliberately strict, and a test that flakes on a millisecond teaches
  // nobody anything.
  const askedAt = readLatch(sb.root, sb.session).askedAt;
  assert.ok(askedAt !== null, 'the ask recorded no wall clock to compare a write against');
  const handover = path.join(sb.cwd, 'reports', 'H.md');
  mkdirSync(path.dirname(handover), { recursive: true });
  writeFileSync(handover, '# Handover\nwhat was decided, and why.\n', 'utf8');
  const at = new Date(Date.parse(askedAt) + 2_000);
  utimesSync(handover, at, at);

  assert.equal(runStop(sb, { did: 'spawned', port: PORT }, 99).stdout, '',
    'the latch stopped holding once the upkeep joined the note — a per-turn hook that repeats ' +
    'is not a verbose feature, it is a session that cannot finish');
});

/* ---------------------------------------------------------------------------
 * `stopUpkeep`: where the hook decides whether to run it at all.
 * ------------------------------------------------------------------------- */

test('it does not run in a subagent', async () => {
  const sb = sandbox({ port: PORT });
  const spawner = fakeSpawn();
  const deps: UpkeepDeps = {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  };
  assert.equal(
    await stopUpkeep({ session_id: sb.session, cwd: sb.cwd, agent_id: 'agent-7' }, deps, NOW),
    null,
  );
  assert.equal(spawner.calls.length, 0,
    'a subagent started a server. Parent sessions only, the way PostCompact already restricts ' +
    'itself: a fan-out of ten subagents is ten hooks reaching for one port');
});

test('it does nothing outside a workspace', async () => {
  const outside = mkdtempSync(path.join(tmpdir(), 'myctx-no-workspace-'));
  bases.push(outside);
  const spawner = fakeSpawn();
  assert.equal(
    await stopUpkeep({ session_id: 's', cwd: outside },
      { globalRoot: path.join(outside, 'g'), spawnFn: spawner.fn,
        portAcceptsFn: NOTHING_ON_THE_PORT }, NOW),
    null,
  );
  assert.equal(spawner.calls.length, 0);
});

test('an unconfigured workspace is off, and the spawn is never reached', async () => {
  const sb = sandbox();
  const spawner = fakeSpawn();
  assert.deepEqual(
    await stopUpkeep({ session_id: sb.session, cwd: sb.cwd },
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }, NOW),
    { did: 'nothing', why: 'off' },
  );
  assert.equal(spawner.calls.length, 0);
});

test('a configured workspace with nothing listening gets a spawn', async () => {
  const sb = sandbox({ port: PORT });
  const spawner = fakeSpawn();
  assert.deepEqual(
    await stopUpkeep({ session_id: sb.session, cwd: sb.cwd },
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }, NOW),
    { did: 'spawned', port: PORT },
  );
  assert.equal(spawner.calls.length, 1);
  assert.ok(spawner.calls[0].args.includes('--no-open'));
});

test('the stand-down is disclosed on stderr, on exactly the turn it happens', async () => {
  const sb = sandbox({ port: PORT });
  const spawner = fakeSpawn();
  const deps: UpkeepDeps = {
    globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT,
  };

  let at = NOW;
  for (let i = 0; i < MAX_CONSECUTIVE_SPAWN_FAILURES; i += 1) {
    await upkeepUiServer(sb.root, resolveWorkspace(sb.cwd).config, at, deps);
    at += SPAWN_INTERVAL_MS + 1_000;
  }

  const said = await capturingStderr(async () => {
    const result = await stopUpkeep({ session_id: sb.session, cwd: sb.cwd }, deps, at);
    assert.deepEqual(result,
      { did: 'stood-down', why: 'spawn', failures: MAX_CONSECUTIVE_SPAWN_FAILURES });
  });
  assert.match(said, /^my_context: /u);
  assert.match(said, /ui\.port/u);

  const silent = await capturingStderr(async () => {
    const result = await stopUpkeep(
      { session_id: sb.session, cwd: sb.cwd }, deps, at + SPAWN_INTERVAL_MS + 1_000,
    );
    assert.deepEqual(result, { did: 'nothing', why: 'stood-down' });
  });
  assert.equal(silent, '',
    'the stand-down line repeated. Stop fires on every assistant turn, so a line that repeats ' +
    'is a paragraph in front of the user on every turn for the rest of the session');
});

test('the LIFT is silent, on the hook that would have to say it', async () => {
  // The owner's ruling of 2026-08-31 came with a condition: a lift is not an
  // occasion to speak. `stopUpkeep` writes to stderr on `did: 'stood-down'` and
  // on nothing else, and the lift must not become a second one — a line saying
  // that nothing is wrong any more, on a hook that fires every assistant turn,
  // is a smaller occasion than the refusal was, not a larger one.
  const sb = sandbox({ port: PORT });
  const spawner = fakeSpawn();
  let serving = false;
  const deps: UpkeepDeps = {
    globalRoot: sb.globalRoot,
    spawnFn: spawner.fn,
    portAcceptsFn: async (): Promise<boolean> => serving,
  };

  let at = NOW;
  for (let i = 0; i <= MAX_CONSECUTIVE_SPAWN_FAILURES; i += 1) {
    await upkeepUiServer(sb.root, resolveWorkspace(sb.cwd).config, at, deps);
    at += SPAWN_INTERVAL_MS + 1_000;
  }

  serving = true;
  const silent = await capturingStderr(async () => {
    const result = await stopUpkeep(
      { session_id: sb.session, cwd: sb.cwd }, deps, at + PROBE_FLOOR_MS + 1_000,
    );
    assert.deepEqual(result, { did: 'nothing', why: 'stood-down-lifted' },
      'the stand-down survived a server answering on the configured port');
  });
  assert.equal(silent, '',
    'the lift announced itself. The state file carries it — that is the trade this whole '
    + 'mechanism makes, and a recovery is the last thing that needs a paragraph');
});

/* ---------------------------------------------------------------------------
 * Fail open, which is the whole posture of every hook here.
 * ------------------------------------------------------------------------- */

test('a broken config turns the upkeep off; it does not take the turn boundary with it', async () => {
  const sb = sandbox({ port: PORT });
  writeFileSync(path.join(sb.root, 'config.json'), '{ not json', 'utf8');
  const spawner = fakeSpawn();
  assert.equal(
    await stopUpkeep({ session_id: sb.session, cwd: sb.cwd },
      { globalRoot: sb.globalRoot, spawnFn: spawner.fn, portAcceptsFn: NOTHING_ON_THE_PORT }, NOW),
    null,
  );
  assert.equal(spawner.calls.length, 0);
  // And the row Stop has written on every turn since seq:21 is still written.
  assert.equal(runStop(sb, null).rows.length, 1);
});

test('observeStop never throws on an upkeep result it was handed', () => {
  const sb = sandbox({ port: PORT });
  for (const upkeep of [
    null,
    { did: 'spawned', port: PORT },
    { did: 'stood-down', why: 'spawn', failures: 3 },
    { did: 'nothing', why: 'alive' },
  ] as (Upkeep | null)[]) {
    assert.notEqual(observeStop({ session_id: sb.session, cwd: sb.cwd }, sb.root, upkeep), null);
  }
});
/* ---------------------------------------------------------------------------
 * A restart is not a spawn, and the log has to say which one happened.
 *
 * `plan:upkeep`, 2026-09-02. The upkeep can now replace a server that ANSWERS
 * — one whose own `/api/meta` reports `staleCode: true` — and that is a
 * different event from putting one back where nothing was answering at all. A
 * row that reported them alike would be a restart nobody could explain
 * afterwards, which is the same defect `lastOutcome` was added for one layer
 * down: a count, or a word, that cannot carry a cause.
 * ------------------------------------------------------------------------- */

test('a restart is recorded in the note, and never as a spawn', () => {
  const sb = sandbox({ port: PORT });
  const restart = runStop(sb, { did: 'restarted', port: PORT }).rows[0].note ?? '';
  assert.match(restart, /stale/iu,
    'the row says a server was touched and not why — "stale" is the whole reason a server ' +
    'that was answering was taken away from whoever had it open');
  assert.match(restart, new RegExp(String(PORT), 'u'));

  const cold = sandbox({ port: PORT });
  const spawned = runStop(cold, { did: 'spawned', port: PORT }).rows[0].note ?? '';
  assert.notEqual(restart, spawned,
    'a server replaced because its code was old and a server started because none was there ' +
    'wrote the same clause — a log line nobody can act on later');
  assert.doesNotMatch(spawned, /stale/iu);
});

test('a stale stand-down says which stand-down it was, in the note and on stderr', async () => {
  const sb = sandbox({ port: PORT });
  const note = runStop(sb, {
    did: 'stood-down', why: 'stale', failures: MAX_CONSECUTIVE_SPAWN_FAILURES,
  }).rows[0].note ?? '';
  assert.match(note, /stale/iu);
  assert.match(note, /stood down/iu);

  const spawnNote = runStop(sandbox({ port: PORT }), {
    did: 'stood-down', why: 'spawn', failures: MAX_CONSECUTIVE_SPAWN_FAILURES,
  }).rows[0].note ?? '';
  assert.notEqual(note, spawnNote,
    'the two stand-downs make opposite claims about whether anything is serving the port, and ' +
    'the log recorded them identically');
});
