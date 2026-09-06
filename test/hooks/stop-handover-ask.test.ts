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
import {
  handoverConfigAt, latchPath, readLatch, NO_LATCH,
} from '../../src/core/handover-ask.ts';
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
  /** `'never'` is the MUTE — `plan:handover seq:11`, and the reason this is not
   * simply `number`. */
  thresholdPercent?: number | 'never';
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
test('an ask that was ACTED ON is never repeated INSIDE the percent that answered it', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.notEqual(runStop(sb, { percent: 99 }).stdout, '', 'the first crossing did not ask');
  writeHandover(sb, 'after');

  assert.equal(runStop(sb, { percent: 99 }).stdout, '',
    'Stop asked again for a handover that had just been written. This is the loop the latch ' +
    'exists to prevent, and it is the half of the old rule seq:12 keeps: the same state is ' +
    'asked about once.');
  assert.equal(runStop(sb, { percent: 99.9 }).stdout, '',
    'a HIGHER READING inside the same whole percent re-armed the ask. 99.0 and 99.9 are one ' +
    'step, not two — the latch stores the whole number for exactly this reason, because a ' +
    'float would re-arm on every turn after the first');
});

/**
 * **THE OWNER'S RULING OF 2026-09-06, AND THE ASSERTION THE OLD RULE FAILED.**
 *
 * The test above used to end *"never repeated, AT ANY OCCUPANCY"*, and this
 * corpus measured what that cost three days running: an ask answered at 85.1%
 * and then two hours and thirty-nine minutes in which the window filled to
 * 99.9% with nothing asking again. Every audit row said `acted-on`, and
 * `acted-on` proves ORDERING — some process touched the file after the ask —
 * never CURRENCY.
 *
 * > *"when handover file is triggerd at 85%, every change up till the context
 * > window is 100% occupy, i mean when the percentage increasing by 1%, you
 * > should always trigger the handover update"*
 *
 * So a handover that WAS written is asked for again the moment the window grows
 * a whole percent, because a percent of a 1M window is roughly ten thousand
 * tokens the document it just wrote does not describe. The paragraph says so
 * rather than pretending the file is missing — a model told to update something
 * it knows it just wrote is a model that learns to ignore the mechanism.
 */
test('a whole percent crossed re-arms an ask that was already acted on', () => {
  const sb = sandbox({ thresholdPercent: 85 });
  assert.notEqual(runStop(sb, { percent: 85.1 }).stdout, '', 'the threshold did not ask');
  writeHandover(sb, 'after');

  assert.equal(runStop(sb, { percent: 85.9 }).stdout, '',
    'the same whole percent asked twice — 85.1 and 85.9 are the same state');

  const next = askedText(runStop(sb, { percent: 86.7 }));
  assert.ok(next !== null,
    'the window grew a whole percent past a handover that was written at 85 and nothing asked ' +
    'again. That is the defect the owner ruled on, measured here at up to 3h 06m of staleness');
  assert.match(next, /86\.7/u);
  assert.match(next, /85%/u, 'the ask does not say what the handover is behind');
  // The step is FLOORED and not rounded, and the paragraph takes the same
  // number the latch stores rather than recomputing it: 86.7 has passed 86, and
  // telling the model it has passed 87 would name a percent the window has not
  // reached and a step nothing has been asked at.
  assert.match(next, /passed 86%/u);
  assert.doesNotMatch(next, /87/u, 'the paragraph rounded the step up');
  assert.equal(readLatch(sb.root, sb.session).askedAtPercent, 86);
  assert.doesNotMatch(next, /NOT been written/u,
    'a handover that WAS written was accused of not existing — the verdict chooses the ' +
    'paragraph, and an accusation nothing supports is the defect this file already pins twice');
});

/**
 * **The whole of seq:9, re-timed by seq:12.** The ask is verified, not assumed:
 * a handover that was never written means the ask was IGNORED, and an ignored
 * ask may be repeated — the repeat is safe because it is MEASURED rather than
 * blind, and that half is untouched.
 *
 * **What was rewritten, and why.** This test used to assert *"repeated exactly
 * once"* and *"there is no third"*, both at one occupancy, because the bound
 * was `MAX_ASKS = 2` and a second turn at the same percent spent the budget.
 * That is the rule the owner replaced. The bound is now a percentage step, so
 * the assertions move to where the bound actually is: the SAME percent is
 * silent however many turns pass in it, and the NEXT percent earns the repeat.
 * A test that simply dropped the bound would be worse than one pinning the
 * wrong bound, so both halves are still here — one silence and one ask.
 */
test('an ignored ask is repeated at the next percent, never inside the one it was made in',
  () => {
    const sb = sandbox({ thresholdPercent: 98 });
    const first = askedText(runStop(sb, { percent: 98.4 }));
    assert.ok(first !== null, 'the first crossing did not ask');
    const askedAt = readLatch(sb.root, sb.session).askedAt;
    assert.ok(askedAt !== null, 'the latch recorded no wall clock for the ask');

    assert.equal(runStop(sb, { percent: 98.9 }).stdout, '',
      'Stop asked twice inside one percent. Nothing had changed but a turn passing, and a ' +
      'per-turn hook that repeats on no new work is a session that cannot finish');

    const second = askedText(runStop(sb, { percent: 99.2 }));
    assert.ok(second !== null,
      'the handover was never written, the window grew a whole percent, and Stop said nothing ' +
      'more about it — which is exactly the silence seq:9 and seq:12 both exist to end');
    // It NAMES the ask it follows. A repeat that reads identically to the
    // original is indistinguishable from a hook that lost its latch.
    assert.match(second, new RegExp(askedAt.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
    assert.match(second, /NOT been written/u);
    assert.doesNotMatch(second, /second and LAST/u,
      'the ask still promises it is the last one. With the bound a percentage step that is a ' +
      'lie, and a deadline a model discovers was false is worth less than no deadline at all');

    assert.equal(runStop(sb, { percent: 99.9 }).stdout, '',
      'a third ask arrived inside a percent already asked at — the bound is one ask per whole ' +
      'percent, and it is the thing this mechanism cannot lose');
  });

/**
 * The two asks are distinguishable in the LOG, without reading the handover —
 * `seq:9`'s DONE WHEN, on the channel that survives the session.
 */
test('the row says which ask this was, and what became of the one before it', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  const first = stopRows(runStop(sb, { percent: 98.4 })).at(-1);
  assert.ok(first, 'no row for the first ask');
  assert.doesNotMatch(first.note ?? '', /AGAIN/u);
  const askedAt = readLatch(sb.root, sb.session).askedAt;
  assert.ok(askedAt !== null);

  const second = stopRows(runStop(sb, { percent: 99.2 })).at(-1);
  assert.ok(second, 'no row for the second ask');
  assert.match(second.note ?? '', /asked AGAIN/u);
  assert.match(second.note ?? '', /went unanswered/u);
  // `SECOND time` used to be enough to say which ask this was, because there
  // were only ever two. A window now carries up to fifteen, so the row has to
  // NAME the ask its verdict belongs to — otherwise "the previous ask went
  // unanswered", repeated down a column of rows, attaches to nothing.
  assert.ok((second.note ?? '').includes(askedAt),
    'the row does not say WHICH ask went unanswered, so the log can no longer answer "was ' +
    'this ask acted on"');
});

/**
 * A handover written BEFORE the ask is not a response to it. The comparison is
 * strictly `>` and this is the case that pins it: without that, any project
 * that keeps a handover file at all would be read as having answered every ask
 * it ever ignored.
 */
test('a handover last written BEFORE the ask does not count as answering it', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.notEqual(runStop(sb, { percent: 98.4 }).stdout, '');
  writeHandover(sb, 'before');

  // Rewritten for seq:12, and the observable moved rather than the rule. The
  // comparison used to decide WHETHER a second ask went out; now progress
  // decides that and the comparison decides WHICH PARAGRAPH goes out. So the
  // assertion is on the words: a file whose last write predates the ask is
  // still an ask that was ignored, and it is still told so.
  const next = askedText(runStop(sb, { percent: 99.2 }));
  assert.ok(next !== null, 'the window grew a whole percent and nothing asked');
  assert.match(next, /NOT been written/u,
    'a file whose last write predates the ask was accepted as an answer to it — without the ' +
    'strict `>`, any project that keeps a handover at all reads as having answered every ask ' +
    'it ever ignored');
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
function retarget(sb: Sandbox, thresholdPercent: number | 'never'): void {
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
 * The bound, now that it is progress rather than a count — `seq:12`.
 *
 * `MAX_ASKS` was 2 and it was checked against a counter, so the whole bound
 * lived in one comparison and one number. It now lives in the relationship
 * between two numbers — the whole percent last asked at, and the whole percent
 * the window is in — and these three tests are what hold that relationship in
 * place: a step earns exactly one ask, a percent that repeats earns none, and
 * nothing above 100 earns anything at all.
 * ------------------------------------------------------------------------- */

/**
 * **The sequence the owner's instruction is really about.** Four turns, three
 * distinct percentages: 85, 86, 86, 87. Three asks go out and the repeated 86
 * is the one turn that is silent — which is to say the ask re-arms exactly
 * twice after the first, once per percent of new work, and not once per turn.
 *
 * Both halves fail loudly if the rule is got wrong in either direction: a
 * mechanism still bounded by a count would go quiet after 86 and never reach
 * 87, and one that re-armed on the READING rather than the whole percent would
 * speak on the second 86 as well.
 */
test('85 -> 86 -> 86 -> 87 asks at each new percent, and stays silent on the repeated one', () => {
  const sb = sandbox({ thresholdPercent: 85 });
  const spoke = [85.2, 86.1, 86.7, 87.3].map(
    (percent) => runStop(sb, { percent }).stdout !== '');

  assert.deepEqual(spoke, [true, true, false, true],
    'the ask did not follow the percentage. Expected one ask at 85, one at 86, silence on the ' +
    'second reading inside 86, and one at 87');
  assert.equal(readLatch(sb.root, sb.session).asks, 3, 'the latch counted the wrong number');
  assert.equal(readLatch(sb.root, sb.session).askedAtPercent, 87,
    'the latch does not carry the whole percent it last asked at, which is the only thing ' +
    'that makes `satisfied` suppress until the next step rather than for the rest of the window');
});

/**
 * **The cap is emergent, and this is what says what it comes to.** Nothing
 * declares fifteen or sixteen anywhere; the number falls out of there being
 * that many whole percentage points between the owner's threshold and a full
 * window. From 85 that is the first ask plus fifteen more, and the last of them
 * lands at 100 because `askStep` clamps there.
 *
 * It is a bound worth pinning precisely because it is emergent: the failure it
 * would catch is not "one ask too many" but a per-turn hook that asks forever,
 * which is the most expensive bug this design can ship.
 */
test('a window filled from the threshold to 100 produces exactly one ask per whole percent',
  () => {
    const sb = sandbox({ thresholdPercent: 85 });
    let asked = 0;
    // Half-percent steps, so every whole percent is READ twice and may only be
    // ASKED at once — thirty-one turns for sixteen asks.
    for (let percent = 85; percent <= 100; percent += 0.5) {
      if (runStop(sb, { percent }).stdout !== '') asked += 1;
    }
    assert.equal(asked, 16,
      'a window from 85 to 100 no longer produces one ask per whole percent — 85 through 100 ' +
      'is sixteen: the first, and the fifteen the owner\'s instruction earns');
    assert.equal(readLatch(sb.root, sb.session).asks, 16);
  });

/**
 * A reading above 100 is a full window, not sixteen more chances to speak.
 * `askStep` clamps rather than refuses — 100.4 IS a window worth asking about —
 * and the clamp is what keeps the mechanism bounded whatever arithmetic arrives
 * from the platform. Without it a bad divisor upstream turns a bounded hook
 * into one that asks on every turn for the rest of the session.
 */
test('an occupancy above 100 is clamped, so a full window cannot keep earning asks', () => {
  const sb = sandbox({ thresholdPercent: 98 });
  assert.notEqual(runStop(sb, { percent: 100.4 }).stdout, '', 'a full window was not asked');
  assert.equal(readLatch(sb.root, sb.session).askedAtPercent, 100,
    'the latch recorded a percent above 100, so every higher reading is a fresh step');
  assert.equal(runStop(sb, { percent: 101.9 }).stdout, '', '101 was treated as a new percent');
  assert.equal(runStop(sb, { percent: 250 }).stdout, '', 'a nonsense reading earned an ask');
});

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

/* ---------------------------------------------------------------------------
 * `plan:handover seq:11` — the ask MUTED, and the delivery kept.
 *
 * `thresholdPercent: "never"` is a person saying *deliver this handover, never
 * ask me for it*. Until it existed the only off switch removed the `handover`
 * key, which also removes the injection they wanted to keep.
 *
 * Two claims are held here and the second is the one that could rot silently:
 * `Stop` says nothing at any occupancy, and it says nothing WITHOUT having
 * turned the mechanism off — unmute the same session and the very next turn
 * asks. A gate written one line too far up (before the config read, say, or by
 * making `handoverConfigAt` return `null`) would pass the first assertion and
 * fail the second, and would have quietly disabled the delivery too.
 * ------------------------------------------------------------------------- */

test('with the ask muted, Stop is silent at every occupancy and latches nothing', () => {
  const sb = sandbox({ thresholdPercent: 'never' });
  for (const percent of [40, 98, 99.9, 100]) {
    const turn = runStop(sb, { percent });
    assert.equal(turn.stdout, '',
      `Stop asked at ${percent}% with the ask muted. "never" is the one value that promises ` +
      'it will not, and a mute that fires at the top of the window is worse than no mute');
    assert.equal(turn.stderr, '',
      'the muted path spoke to the user. A person who switched the ask off must not then be ' +
      'asked to install a status-line bridge for it');
  }
  // NOTHING was written for this session: no ask, no percent, no stand-down.
  // The latch is the record every other surface reads, so a mute that still
  // stamped one would put an ask on the strip that never happened.
  assert.deepEqual(readLatch(sb.root, sb.session), NO_LATCH);
  assert.equal(existsSync(latchPath(sb.root, sb.session)), false);
  // And the turn is still recorded, exactly as on every other silent turn.
  assert.equal(stopRows(runStop(sb, { percent: 99 })).length, 5);
});

test('the mute is the ONLY thing silencing it — unmuted, the same session is asked', () => {
  const sb = sandbox({ thresholdPercent: 'never' });
  assert.equal(runStop(sb, { percent: 99 }).stdout, '', 'muted');

  retarget(sb, 98);
  const asked = askedText(runStop(sb, { percent: 99 }));
  assert.ok(asked, 'unmuting did not restore the ask, so the mute had switched the mechanism ' +
    'off rather than quieting it');
  assert.match(asked, /reports\/H\.md/u);
  assert.equal(readLatch(sb.root, sb.session).askedAtPercent, 99);

  // And back again, on the same session and the same window: the next whole
  // percent would have earned another ask, and the mute takes it away.
  retarget(sb, 'never');
  assert.equal(runStop(sb, { percent: 100 }).stdout, '',
    'a session already asked once kept asking after being muted');
});

test('a muted workspace still has its handover CONFIGURED — the delivery is untouched', () => {
  const sb = sandbox({ thresholdPercent: 'never' });
  const handover = handoverConfigAt(sb.root);
  // The half of the feature the mute must not reach. `select()` and the
  // continuity tier read `path`, `marker` and `budgetTokens` and never a
  // threshold, so what pins the delivery here is that the block is still THERE
  // and complete — `handoverConfigAt` returning `null` is the whole feature off,
  // which is precisely the switch this state exists to avoid needing.
  assert.ok(handover, 'the mute switched the whole handover off');
  assert.equal(handover.path, 'reports/H.md');
  assert.equal(handover.thresholdPercent, 'never');
  assert.equal(handover.budgetTokens, 1200);
});
