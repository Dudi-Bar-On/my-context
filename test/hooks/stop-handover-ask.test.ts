/**
 * **The first bytes this project has ever put on `Stop`'s stdout, and the
 * narrowness is the whole test.**
 *
 * `src/hooks/stop.ts`'s header records why the `additionalContext` envelope has
 * been deliberately empty since the ten observation hooks landed: filling it is
 * a product speaking into EVERY turn of every session, `hooks seq:21` named the
 * argument for moving the capture nudge here and explicitly did not make the
 * ruling, and the question was reported to the owner rather than answered by a
 * commit. The owner asking for the occupancy requirement on 2026-08-27 is that
 * ruling arriving — `DEC-stop-speaks-once-and-only-to-raise-the-handover` — and
 * it is narrow in three directions, each of which is a test below:
 *
 *  - **One purpose.** `Stop` speaks to raise the handover at the threshold and
 *    for nothing else. Below the threshold, with no handover configured, or
 *    with no measurement, stdout is empty exactly as it has always been.
 *  - **At most once per session per crossing**, latched in state. A second ask
 *    after the model has already written the handover is a loop, and a loop in
 *    a per-turn hook is the most expensive bug this design can ship — so the
 *    once-only test is the load-bearing one here, not the once-at-all test.
 *  - **It never blocks and it never guesses.** With no status-line bridge the
 *    mechanism stands down on stderr, once, and no percentage is invented
 *    (`STD-absent-vs-zero`, and `core/context-occupancy.ts` says why there is
 *    deliberately no transcript fallback).
 *
 * And one thing that must NOT have changed: the audit row `Stop` has written on
 * every assistant turn since seq:21. That row is the only line in the log that
 * says where one exchange ended and the next began, and a feature that costs it
 * would be a bad trade nobody agreed to.
 *
 * **In-process, through `observeAndRecord`**, not through the binary. The
 * binary path is already covered end-to-end by
 * `test/hooks/observation-binaries-e2e.test.ts` (which pins, in a workspace with
 * no `handover` key, that `Stop` writes nothing at all to either channel); what
 * this file needs is a status-line fixture, a config and a latch inspected
 * across several turns of ONE session, and a spawn per turn would buy none of
 * that and cost seconds.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { readLatch } from '../../src/core/handover-ask.ts';
import { CONTEXT_SAMPLE_FRESH_MS } from '../../src/core/context-occupancy.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import { STOP } from '../../src/hooks/stop.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * Every sandbox this file makes, removed once at the end —
 * `pre-compact-occupancy.test.ts`'s pattern, for its reason: several tests run
 * MORE THAN ONE turn against one workspace, so the workspace outlives any single
 * `t.after`.
 */
const roots: string[] = [];
after(() => { for (const root of roots) removeTree(root); });

/** A `context_window` block in the shape Claude Code actually sends. */
function sampleAt(percent: number, window = 200_000): Record<string, unknown> {
  return {
    context_window: {
      context_window_size: window,
      current_usage: {
        input_tokens: (window * percent) / 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        // On the wire, and deliberately non-zero: it must NOT reach the total.
        output_tokens: 1_234,
      },
    },
  };
}

interface Sandbox {
  /** The repository directory a hook payload would carry as `cwd`. */
  cwd: string;
  /** The `.my_context` directory — what `readOccupancy` is given. */
  root: string;
  /** The session every turn in this sandbox belongs to, unless overridden. */
  session: string;
}

let sessionCounter = 0;

/**
 * A workspace with (or deliberately without) a `handover` key.
 *
 * The config is MERGED into whatever `init` wrote rather than replacing it: a
 * test that silently drops the rest of a real `config.json` would be testing a
 * shape no user has.
 */
function sandbox(options: {
  handoverPath?: string | null;
  thresholdPercent?: number;
} = {}): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stop-ask-'));
  roots.push(cwd);
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root, 'the sandbox has no workspace');

  const handoverPath = options.handoverPath === undefined ? 'reports/H.md' : options.handoverPath;
  if (handoverPath !== null) {
    const file = path.join(root, 'config.json');
    const raw = existsSync(file)
      ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
      : {};
    const handover: Record<string, unknown> = { path: handoverPath };
    if (options.thresholdPercent !== undefined) {
      handover.thresholdPercent = options.thresholdPercent;
    }
    writeFileSync(file, JSON.stringify({ ...raw, handover }, null, 2), 'utf8');
  }

  sessionCounter += 1;
  return { cwd, root, session: `sess-${sessionCounter}` };
}

interface Turn {
  /** Everything the hook would have written to the model's context. */
  stdout: string;
  /** Everything the hook would have shown the user. */
  stderr: string;
  /** Every audit row in the workspace after this turn. */
  rows: AuditRecord[];
}

/**
 * One assistant turn ending, with the status-line bridge in whichever state the
 * options ask for.
 *
 * The tee is written through `writeTee`, the real writer, so the file name and
 * the `{ receivedAt, payload }` envelope stay `statusline-tee.ts`'s to decide —
 * `pre-compact-occupancy.test.ts` takes the same care and for the same reason: a
 * fixture that hand-rolls another module's file format stops testing that module
 * the day it changes.
 */
function runStop(sb: Sandbox, options: {
  percent?: number;
  /** `false` installs no `.statusline/` at all — the `no-bridge` case. */
  bridge?: boolean;
  session?: string;
  /**
   * Ages the sample past `CONTEXT_SAMPLE_FRESH_MS` — the `stale` case
   * (`plan:walk seq:123`). `writeTee`'s third argument is the real writer's own
   * `receivedAt`, so the fixture ages the way a real sample ages.
   */
  staleSample?: boolean;
} = {}): Turn {
  const session = options.session ?? sb.session;
  if (options.bridge !== false && options.percent !== undefined) {
    const receivedAt = options.staleSample === true
      ? new Date(Date.now() - CONTEXT_SAMPLE_FRESH_MS - 60_000).toISOString()
      : new Date().toISOString();
    const written = writeTee(
      sb.root, { session_id: session, ...sampleAt(options.percent) }, receivedAt);
    assert.deepEqual(written, { written: true }, 'the status-line fixture was not written');
  }

  let stderr = '';
  const realWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;

  let outcome: { note: string | null; stdout: string };
  try {
    outcome = observeAndRecord(
      STOP,
      { session_id: session, cwd: sb.cwd, hook_event_name: 'Stop', stop_hook_active: false },
      sb.cwd,
    );
  } finally {
    process.stderr.write = realWrite;
  }

  return { stdout: outcome.stdout, stderr, rows: readAudit(sb.root) };
}

/** The `additionalContext` this turn delivered, or `null` when it delivered none. */
function askedText(turn: Turn): string | null {
  if (turn.stdout === '') return null;
  const envelope = JSON.parse(turn.stdout) as {
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  assert.equal(envelope.hookSpecificOutput?.hookEventName, 'Stop',
    'the envelope is stamped with the wrong event — Claude Code does not reject that, it just ' +
    'never delivers the context, which is the silent failure `hookContext` exists to prevent');
  const text = envelope.hookSpecificOutput?.additionalContext;
  assert.equal(typeof text, 'string', 'the envelope carries no additionalContext');
  return text as string;
}

function stopRows(turn: Turn): AuditRecord[] {
  return turn.rows.filter((r) => r.op === 'stop');
}

/* ---------------------------------------------------------------------------
 * The emptiness that stands — three ways of not asking.
 * ------------------------------------------------------------------------- */

test('below the threshold Stop writes NOTHING to stdout, as it always has', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  const turn = runStop(sb, { percent: 40 });
  assert.equal(turn.stdout, '',
    'Stop spoke below the threshold. The envelope was ruled open for ONE purpose; every other ' +
    'use of it is still the owner\'s and still unruled');
  assert.equal(turn.stderr, '', 'a measurable, uninteresting turn disclosed something');
});

/**
 * The mechanism is OFF, not merely quiet: a plugin does not read a document in
 * somebody's repository because it was installed, and it does not lecture them
 * about a status-line bridge they never asked for either. So the unconfigured
 * case is silent on BOTH channels, at any occupancy and with no bridge at all.
 */
test('with no handover configured it never asks, whatever the occupancy', () => {
  const sb = sandbox({ handoverPath: null });
  const full = runStop(sb, { percent: 99.9 });
  assert.equal(full.stdout, '');
  assert.equal(full.stderr, '');

  const noBridge = runStop(sb, { bridge: false });
  assert.equal(noBridge.stdout, '');
  assert.equal(noBridge.stderr, '',
    'the stand-down line asks the user to install a bridge for a feature they have not ' +
    'configured — an unconfigured mechanism promised nothing, so it has nothing to disclose');
});

/**
 * **THE FOSSIL, WHICH IS WHY THIS MECHANISM LOOKED LIKE IT WORKED** —
 * `plan:walk seq:123`.
 *
 * The reported case: the sample read 60.1% and had been received 29 hours
 * earlier, while the window was actually full. `readOccupancy` had no freshness
 * check, so `Stop` compared a dead 60.1 against the threshold, fell below it,
 * and returned `null`. **The ask never fired and nothing said why** — which is
 * indistinguishable from a mechanism working correctly on a session that never
 * filled up, and is exactly the silence this whole feature exists to end.
 *
 * With the gate on the server side, the fossil is refused before the
 * comparison. The ask still does not fire — it must not, because nobody knows
 * how full the window is — but the mechanism now STANDS DOWN and says so, which
 * is the difference between a feature that is quiet and a feature that is
 * broken.
 *
 * Both halves are asserted, because either alone would pass over the defect: no
 * ask (a fossil must never trigger one either, at any percentage) AND a
 * disclosure naming the reason.
 */
test('a 29-hour-old sample stands down and SAYS so, instead of comparing a dead number', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  const turn = runStop(sb, { percent: 60.1, staleSample: true });
  assert.equal(turn.stdout, '', 'a fossil is not a measurement and must not drive an ask');
  assert.notEqual(turn.stderr, '',
    'silence here is the reported defect: the mechanism stood down and nobody was told');
  assert.match(turn.stderr, /fifteen minutes/u);
  assert.doesNotMatch(turn.stderr, /statusline install/u,
    'the bridge IS installed — telling this user to install it is the collapse the four ' +
    'reasons exist to undo');
});

/**
 * The other half of the same gate: a stale sample ABOVE the threshold is still
 * refused. This is the case that would be tempting to let through — "it says
 * 99.9, surely we should ask" — and it is the one that matters most, because an
 * ask fired off a fossil sends the model to rewrite a handover against a window
 * whose real occupancy nobody knows.
 */
test('a stale sample above the threshold does not ask either', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.equal(runStop(sb, { percent: 99.9, staleSample: true }).stdout, '');
  // The control, so this test cannot pass because the harness stopped asking:
  // the same percentage, fresh, in a fresh sandbox, DOES ask.
  assert.notEqual(runStop(sandbox({ thresholdPercent: 98 }), { percent: 99.9 }).stdout, '');
});

/* ---------------------------------------------------------------------------
 * The ask itself — the whole product surface of this feature.
 * ------------------------------------------------------------------------- */

test('at the threshold Stop emits ONE additionalContext envelope naming the file and the number',
  () => {
    const sb = sandbox({ thresholdPercent: 98 });
    const turn = runStop(sb, { percent: 98.4 });
    const text = askedText(turn);
    assert.ok(text !== null, 'the threshold was crossed and nothing was asked');

    // The path, because a model told to "update the handover" has to be told
    // WHICH file, and the number, because an instruction with no measurement
    // behind it is one the model can reasonably weigh against what it was
    // doing. These two are the whole reason the envelope was opened.
    assert.match(text, /reports\/H\.md/u);
    assert.match(text, /98\.4/u);

    // And it has to say that this turn is the last one — that is the fact that
    // makes it urgent rather than a suggestion.
    assert.match(text, /this turn/iu);

    // ONE envelope. Two would be two blocks of context and, on a real payload,
    // two JSON objects on one stream, which Claude Code parses as neither.
    assert.equal(turn.stdout.trimEnd().split('\n').length, 1);
    assert.doesNotThrow(() => JSON.parse(turn.stdout));
  });

/** An exact crossing IS a crossing. `>=`, not `>`: a threshold nobody can land on. */
test('the threshold is crossed AT the threshold, not only above it', () => {
  const sb = sandbox({ thresholdPercent: 90 });
  assert.notEqual(runStop(sb, { percent: 90 }).stdout, '');
});

/**
 * The note is how the log says this happened at all — stdout leaves no trace,
 * so without it a session that was asked and a session that was not are
 * indistinguishable afterwards.
 */
test('the row says the ask was made, and at what', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  const turn = runStop(sb, { percent: 98.4 });
  const row = stopRows(turn).at(-1);
  assert.ok(row, 'the turn recorded no stop row');
  assert.match(row.note ?? '', /98\.4/u);
  assert.match(row.note ?? '', /handover/iu);
});

/* ---------------------------------------------------------------------------
 * The latch — the load-bearing test in this file.
 * ------------------------------------------------------------------------- */

/**
 * **The rule seq:9 replaced, and the half of it that did not change.**
 *
 * A blind second ask arrives AFTER the model has just written the handover, so
 * it asks for work that was done in the turn that produced it — and it arrives
 * on the next turn too, and the one after. That is still the loop, and it is
 * still forbidden: an ask that was ACTED ON is never repeated.
 *
 * What changed is that "acted on" is now measured rather than assumed
 * (`DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is`), so this
 * test writes the handover the way a model would and then insists on silence
 * for the rest of the session, at any occupancy.
 */
test('an ask that was ACTED ON is never repeated, at any occupancy', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.notEqual(runStop(sb, { percent: 99 }).stdout, '', 'the first crossing did not ask');
  writeHandover(sb, 'after');

  assert.equal(runStop(sb, { percent: 99 }).stdout, '',
    'Stop asked again for a handover that had just been written. This is the loop the latch ' +
    'exists to prevent, and measuring the file is what makes the second ask safe elsewhere.');
  assert.equal(runStop(sb, { percent: 99.9 }).stdout, '',
    'a HIGHER occupancy after the ask re-armed it — the latch is per session, not per reading');
});

/**
 * **The whole of seq:9 in one test.** The ask is verified, not assumed: a
 * handover that was never written means the ask was IGNORED, and an ignored ask
 * may be repeated exactly once. The bound is what makes the repeat safe — *a
 * third would be nagging, and a hook that nags is a hook that gets uninstalled*.
 */
test('an ask that was IGNORED is repeated exactly once, and the second names the first', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  const first = askedText(runStop(sb, { percent: 99 }));
  assert.ok(first !== null, 'the first crossing did not ask');
  const askedAt = readLatch(sb.root, sb.session).askedAt;
  assert.ok(askedAt !== null, 'the latch recorded no wall clock for the ask');

  const second = askedText(runStop(sb, { percent: 99 }));
  assert.ok(second !== null,
    'the handover was never written and Stop said nothing more about it — which is exactly ' +
    'the silence seq:9 exists to end');
  // It NAMES the first. A repeat that reads identically to the original is
  // indistinguishable from a hook that lost its latch.
  assert.match(second, new RegExp(askedAt.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.match(second, /NOT been written/u);
  assert.match(second, /second and LAST/u);

  assert.equal(runStop(sb, { percent: 99.9 }).stdout, '',
    'Stop asked a THIRD time. There is no third: the audit row is the accountability story ' +
    'for the asks that went unanswered.');
});

/**
 * The two asks are distinguishable in the LOG, without reading the handover —
 * `seq:9`'s DONE WHEN, on the channel that survives the session.
 */
test('the row says which ask this was, and that the first went unanswered', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  const first = stopRows(runStop(sb, { percent: 99 })).at(-1);
  assert.ok(first, 'no row for the first ask');
  assert.doesNotMatch(first.note ?? '', /SECOND/u);

  const second = stopRows(runStop(sb, { percent: 99 })).at(-1);
  assert.ok(second, 'no row for the second ask');
  assert.match(second.note ?? '', /SECOND time/u);
  assert.match(second.note ?? '', /went unanswered/u);
});

/**
 * A handover written BEFORE the ask is not a response to it. The comparison is
 * strictly `>` and this is the case that pins it: without that, any project
 * that keeps a handover file at all would be read as having answered every ask
 * it ever ignored.
 */
test('a handover last written BEFORE the ask does not count as answering it', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.notEqual(runStop(sb, { percent: 99 }).stdout, '');
  writeHandover(sb, 'before');
  assert.notEqual(runStop(sb, { percent: 99 }).stdout, '',
    'a file whose last write predates the ask was accepted as an answer to it');
});

/** The latch is per SESSION, not per workspace: a second session asks for itself. */
test('a different session in the same workspace gets its own ask', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.notEqual(runStop(sb, { percent: 99 }).stdout, '');
  assert.notEqual(runStop(sb, { percent: 99, session: 'another-session' }).stdout, '',
    'one session\'s ask silenced another\'s — the latch is keyed on the workspace, not the ' +
    'context window, which is the thing that actually gets compacted');
});

/**
 * The latch holds the THRESHOLD it asked at, which is what makes the two edits a
 * user might make mid-session behave differently — and they should. Lowering the
 * threshold is somebody saying *ask me sooner than that*, which is a new
 * instruction; raising it is not a request for anything and must not re-arm a
 * mechanism that has already spoken.
 */
test('lowering the threshold mid-session can ask again; raising it cannot', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.notEqual(runStop(sb, { percent: 99 }).stdout, '');
  // The handover is written, so the ask is SATISFIED and the only axis left in
  // play is the threshold. Without this the re-ask below would be seq:9's
  // ignored-ask repeat and the test would be measuring the wrong mechanism.
  writeHandover(sb, 'after');

  retarget(sb, 99.5);
  assert.equal(runStop(sb, { percent: 99.6 }).stdout, '',
    'raising the threshold re-armed the ask — nobody asked to be asked again');

  retarget(sb, 90);
  assert.notEqual(runStop(sb, { percent: 99.6 }).stdout, '',
    'lowering the threshold did not re-arm the ask, so the only way to be asked sooner is to ' +
    'start a new session');
});

/** Rewrites just `handover.thresholdPercent`, leaving the rest of the config alone. */
function retarget(sb: Sandbox, thresholdPercent: number): void {
  const file = path.join(sb.root, 'config.json');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { handover?: Record<string, unknown> };
  raw.handover = { ...raw.handover, thresholdPercent };
  writeFileSync(file, JSON.stringify(raw, null, 2), 'utf8');
}

/**
 * The model writing the handover, placed on either side of the ask.
 *
 * **The mtime is SET rather than left to the clock**, and that is the whole
 * reason this helper exists. A file written in the same millisecond as the ask
 * is a coin flip against a comparison that is deliberately strict, and a test
 * that flakes on a millisecond teaches nobody anything. Two seconds either side
 * of the recorded `askedAt` is unambiguous in both directions and exercises the
 * real code path — `checkHandoverAsk` reads an mtime and does not care who set
 * it.
 */
function writeHandover(sb: Sandbox, when: 'before' | 'after'): void {
  const askedAt = readLatch(sb.root, sb.session).askedAt;
  assert.ok(askedAt !== null, 'nothing has been asked yet, so there is no ask to write around');
  const file = path.join(sb.cwd, 'reports', 'H.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '# Handover\nwhat was decided, and why.\n', 'utf8');
  const at = new Date(Date.parse(askedAt) + (when === 'after' ? 2_000 : -2_000));
  utimesSync(file, at, at);
}

/* ---------------------------------------------------------------------------
 * Standing down — the path most likely to actually run.
 * ------------------------------------------------------------------------- */

/**
 * Measured 2026-08-27: there is no `.statusline` directory in this corpus and
 * the owner's status line belongs to another plugin, so `no-bridge` is the state
 * of this machine today. It is therefore the path that must be quietest and
 * clearest, and the one where a guessed percentage would do the most damage —
 * a number invented here is a handover demanded at a moment nobody measured.
 */
test('unmeasurable stands down on STDERR once and never guesses a number', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  const first = runStop(sb, { bridge: false });
  assert.equal(first.stdout, '',
    'the mechanism asked for a handover with no measurement behind it');
  assert.match(first.stderr, /statusline/u);
  assert.doesNotMatch(first.stderr, /\d+(\.\d+)?%/u,
    'the stand-down line quoted a percentage. There is no percentage: STD-absent-vs-zero, and ' +
    'core/context-occupancy.ts refuses a transcript fallback for exactly this reason');

  const second = runStop(sb, { bridge: false });
  assert.equal(second.stderr, '',
    'the stand-down repeated. `Stop` fires on every assistant turn, so a line that repeats is a ' +
    'paragraph per turn for the whole session');
  assert.equal(second.stdout, '');
});

/**
 * The bridge is installed but has no reading for THIS session — what a session
 * that has just started or has just been compacted looks like. It is not a
 * broken bridge and it is not a reason to ask for anything.
 */
test('an installed bridge with no sample for this session also stands down, without a number',
  () => {
    const sb = sandbox({ thresholdPercent: 98 });
    // A sample for someone else installs `.statusline/` without answering for us.
    const written = writeTee(sb.root, { session_id: 'somebody-else', ...sampleAt(99) });
    assert.deepEqual(written, { written: true });

    const turn = runStop(sb);
    assert.equal(turn.stdout, '');
    assert.match(turn.stderr, /my_context:/u);
    assert.doesNotMatch(turn.stderr, /\d+(\.\d+)?%/u);
  });

/* ---------------------------------------------------------------------------
 * What must not have changed.
 * ------------------------------------------------------------------------- */

/**
 * `Stop`'s row is the only line in the audit log that says where one exchange
 * ended and the next began — `src/hooks/stop.ts`'s header calls that the reason
 * it is the one observation hook that records on the ordinary path. Every branch
 * this task adds still has to leave it, including the ones that say nothing.
 */
test('the audit row Stop already wrote is still written, every turn', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.equal(stopRows(runStop(sb, { percent: 40 })).length, 1, 'below the threshold');
  assert.equal(stopRows(runStop(sb, { percent: 99 })).length, 2, 'at the ask itself');
  assert.equal(stopRows(runStop(sb, { percent: 99 })).length, 3, 'on the latched turn after it');
  const last = stopRows(runStop(sb, { bridge: false })).at(-1);
  assert.ok(last, 'the stand-down turn recorded nothing');
  assert.match(last.note ?? '', /stop_hook_active=false/u,
    'the row lost what it has always said');
});

/** An unconfigured workspace records the row too — the e2e binaries pin this shape. */
test('a workspace with no handover key still records the turn', () => {
  const sb = sandbox({ handoverPath: null });
  const turn = runStop(sb, { percent: 99 });
  assert.equal(stopRows(turn).length, 1);
  assert.match(stopRows(turn)[0].note ?? '', /the assistant turn ended/u);
});

/**
 * Nine of the ten observation hooks never set `context`, and adding the field
 * must not have given any of them a voice. Asserted through `Stop` itself
 * because it is the only spec that CAN speak: an unconfigured workspace is the
 * same code path the other nine take on every firing.
 */
test('an observation that sets no context writes no envelope at all', () => {
  const sb = sandbox({ handoverPath: null });
  assert.equal(runStop(sb, { percent: 99 }).stdout, '');
});
