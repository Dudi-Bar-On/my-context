/**
 * **The ask budget belongs to a WINDOW, not to a session** — plan `handover`
 * seq:10, the owner's ruling of 2026-08-29.
 *
 * `MAX_ASKS` is 2 and the latch is stored per session. Those were the same
 * thing until a compaction and after one they are not: the session continues
 * with the latch it had, so a session that had spent both asks was never asked
 * about the window the compaction had just refilled — which is exactly the
 * window a handover exists to serve. `seq:10` recorded the choice as a
 * question, the owner answered it *per window*, and this file is what holds the
 * answer in place.
 *
 * **What it pins:**
 *
 *  - A second context window gets its own two asks, and the first of them is a
 *    FIRST ask — not a repeat naming an ask that belonged to a window nobody
 *    can read any more.
 *  - The bound survives the change. Two per window, never three, and the reset
 *    is idempotent per compaction: one compaction returns the budget once,
 *    however many times `PostCompact` fires for it.
 *  - **The window is the continuity tier's window.** The marker stamped on the
 *    latch is byte-identical to the `capturedAt` of the snapshot `restoredFor`
 *    and `continuityFor` compare against (`plan:live seq:9`). Two mechanisms
 *    deciding independently what a new window is would be the two-spellings
 *    defect this project keeps paying for; this test is what would fail if a
 *    second notion of a window ever appeared here.
 *  - **A compaction with no snapshot returns nothing.** No snapshot is no
 *    identity, and this module's tie-break is one ask fewer rather than one
 *    more — a hook that nags is a hook that gets uninstalled.
 *  - `seq:9`'s five verdicts keep their meanings across a reset, and
 *    `unverifiable` never folds into `ignored`.
 *
 * **In-process, through `observeAndRecord` and the two hook builders**, for
 * `stop-handover-ask.test.ts`'s reason: what this file needs is a latch
 * inspected across several turns and two compactions of ONE session, and a
 * spawn per turn would buy none of that and cost seconds.
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
import { latchPath, readLatch, writeLatch } from '../../src/core/handover-ask.ts';
import { readSnapshotMeta } from '../../src/core/ledger.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { recordPostCompact, type PostCompactOutcome } from '../../src/hooks/post-compact.ts';
import { STOP } from '../../src/hooks/stop.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * Every sandbox this file makes, removed once at the end — every test here runs
 * several turns and at least one compaction against ONE workspace, so the
 * workspace outlives any single `t.after`.
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
        output_tokens: 1_234,
      },
    },
  };
}

interface Sandbox {
  /** The repository directory a hook payload carries as `cwd`. */
  cwd: string;
  /** The `.my_context` directory — where the latch and the snapshot live. */
  root: string;
  session: string;
}

let sessionCounter = 0;

/**
 * A workspace with (or deliberately without) a `handover` key, MERGED into
 * whatever `init` wrote: a test that silently drops the rest of a real
 * `config.json` is testing a shape no user has.
 */
function sandbox(options: { handoverPath?: string | null } = {}): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ask-window-'));
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
    writeFileSync(
      file,
      JSON.stringify({ ...raw, handover: { path: handoverPath, thresholdPercent: 98 } }, null, 2),
      'utf8',
    );
  }

  sessionCounter += 1;
  return { cwd, root, session: `ask-window-${sessionCounter}` };
}

/** Captures everything a hook body writes to stderr while it runs. */
function capturing<T>(body: () => T): { value: T; stderr: string } {
  let stderr = '';
  const real = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    return { value: body(), stderr };
  } finally {
    process.stderr.write = real;
  }
}

/** One assistant turn ending at `percent` occupancy. Returns the hook's stdout. */
function runStop(sb: Sandbox, percent: number): string {
  const written = writeTee(sb.root, { session_id: sb.session, ...sampleAt(percent) });
  assert.deepEqual(written, { written: true }, 'the status-line fixture was not written');
  return capturing(() => observeAndRecord(
    STOP,
    { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'Stop', stop_hook_active: false },
    sb.cwd,
  )).value.stdout;
}

/** The `additionalContext` this turn delivered, or `null` when it delivered none. */
function askedText(stdout: string): string | null {
  if (stdout === '') return null;
  const envelope = JSON.parse(stdout) as {
    hookSpecificOutput?: { additionalContext?: string };
  };
  const text = envelope.hookSpecificOutput?.additionalContext;
  assert.equal(typeof text, 'string', 'the envelope carries no additionalContext');
  return text as string;
}

/**
 * A busy wait of at most one millisecond.
 *
 * `writeSnapshot` stamps `capturedAt` from `new Date().toISOString()`, which is
 * millisecond-resolution, and the whole mechanism under test compares two of
 * them for EQUALITY. Two compactions staged in one test can land inside one
 * millisecond on a fast machine, and the second would then be read as a repeat
 * firing of the first — a green test that proves the opposite of what it says.
 * A sleep would be a guess; this is exact.
 */
function tick(): void {
  const start = Date.now();
  while (Date.now() === start) { /* the clock has not moved yet */ }
}

/**
 * One whole compaction: `PreCompact` writes the restore snapshot and judges the
 * outstanding ask, `PostCompact` records the outcome and returns the budget.
 * Both real builders, in the order Claude Code fires them.
 */
function compact(sb: Sandbox, options: { snapshot?: boolean } = {}): {
  outcome: PostCompactOutcome | null;
  capturedAt: string | null;
  stderr: string;
} {
  tick();
  let stderr = '';
  if (options.snapshot !== false) {
    stderr += capturing(() => buildRestoreSnapshot(
      { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'PreCompact', trigger: 'auto' },
      sb.cwd,
    )).stderr;
  }
  const run = capturing(() => recordPostCompact(
    {
      session_id: sb.session, cwd: sb.cwd, hook_event_name: 'PostCompact',
      trigger: 'auto', compact_summary: 'the conversation so far, in brief.',
    },
    sb.cwd,
  ));
  return {
    outcome: run.value,
    capturedAt: readSnapshotMeta(sb.root, sb.session)?.capturedAt ?? null,
    stderr: stderr + run.stderr,
  };
}

function lastRow(sb: Sandbox, op: string): AuditRecord {
  const row = readAudit(sb.root).filter((r) => r.op === op && r.sessionId === sb.session).at(-1);
  assert.ok(row, `no ${op} row was recorded`);
  return row;
}

/** The model writing the handover, placed after the ask so it reads as an answer. */
function writeHandover(sb: Sandbox): void {
  const askedAt = readLatch(sb.root, sb.session).askedAt;
  assert.ok(askedAt !== null, 'nothing has been asked yet');
  const file = path.join(sb.cwd, 'reports', 'H.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '# Handover\nwhat was decided, and why.\n', 'utf8');
  const at = new Date(Date.parse(askedAt) + 2_000);
  utimesSync(file, at, at);
}

/* ---------------------------------------------------------------------------
 * The whole of seq:10, in one test.
 * ------------------------------------------------------------------------- */

/**
 * **The load-bearing test in this file.** A session spends both asks, is
 * compacted, and is asked again about the window that came back — twice, from
 * the top, because that window has never been asked anything.
 *
 * Before seq:10 the last three assertions all read `''`: the session had spent
 * its budget and the refilled window, the one the whole feature exists to
 * serve, was the one window it could never be asked about.
 */
test('a second context window gets its own two asks', () => {
  const sb = sandbox();

  const first = askedText(runStop(sb, 99));
  assert.ok(first !== null, 'the first crossing did not ask');
  assert.doesNotMatch(first, /second and LAST/u, 'the first ask announced itself as a repeat');

  const second = askedText(runStop(sb, 99));
  assert.ok(second !== null, 'the ignored ask was not repeated');
  assert.match(second, /second and LAST/u);

  assert.equal(runStop(sb, 99.9), '',
    'the budget was not spent — this window was asked a THIRD time');

  const compaction = compact(sb);
  assert.equal(compaction.outcome?.askBudget, 'reset');

  const third = askedText(runStop(sb, 99));
  assert.ok(third !== null,
    'the window the compaction rebuilt was never asked about, which is the window a handover ' +
    'exists to serve — this is the whole of the defect seq:10 closes');
  assert.doesNotMatch(third, /second and LAST/u,
    'the new window\'s FIRST ask named an ask belonging to a window nobody can read any more');

  const fourth = askedText(runStop(sb, 99));
  assert.ok(fourth !== null, 'the new window was not allowed its second ask');
  assert.match(fourth, /second and LAST/u);

  assert.equal(runStop(sb, 99.9), '',
    'the bound did not survive the change: two per window, never three. A hook that nags is ' +
    'a hook that gets uninstalled.');
});

/**
 * The bound is per window and the count really did go back to zero, rather than
 * the ask merely being re-armed by something else in the latch. Read from the
 * latch itself so the assertion cannot be satisfied by a coincidence of the
 * threshold rule.
 */
test('the compaction returns the count itself, not just the arming state', () => {
  const sb = sandbox();
  runStop(sb, 99);
  runStop(sb, 99);
  const spent = readLatch(sb.root, sb.session);
  assert.equal(spent.asks, 2);
  assert.ok(spent.askedAt !== null);

  compact(sb);
  const returned = readLatch(sb.root, sb.session);
  assert.equal(returned.asks, 0, 'the count was not returned');
  assert.equal(returned.askedAt, null,
    'an ask belonging to the destroyed window survived it, so the new window\'s first ask ' +
    'would be judged against a file written for a different one');
  assert.equal(returned.askedAtThreshold, null);
  assert.equal(returned.satisfied, false);
});

/* ---------------------------------------------------------------------------
 * The window is the continuity tier's window, and not a second one.
 * ------------------------------------------------------------------------- */

/**
 * **The constraint this task was given, as an assertion.** `plan:live seq:9`
 * established that a rebuilt window is identified by the restore snapshot's
 * `capturedAt`, and the continuity tier keys its dedupe on exactly that field
 * (`restoredFor` / `continuityFor`, both `core/seen-file.ts`). The ask budget
 * takes the same value off the same object, read once by `PostCompact`.
 *
 * If a second notion of a window ever appears here — a counter, an event count,
 * a fresh `Date.now()` — this is the assertion that fails, and it fails before
 * the two spellings have had time to drift apart.
 */
test('the latch window IS the snapshot capturedAt the continuity tier compares against', () => {
  const sb = sandbox();
  runStop(sb, 99);

  const compaction = compact(sb);
  assert.ok(compaction.capturedAt !== null, 'the compaction wrote no snapshot');
  assert.equal(readLatch(sb.root, sb.session).window, compaction.capturedAt,
    'the ask budget is keyed on something other than the snapshot capturedAt — two mechanisms ' +
    'deciding independently what a new window is, which is the defect this codebase keeps ' +
    'paying for');
  assert.equal(compaction.outcome?.askBudget, 'reset');
});

/**
 * One compaction returns the budget ONCE, however many times `PostCompact`
 * fires for it — the same equality-on-`capturedAt` idempotence `restoredFor`
 * has, and for the same reason: a marker compared for equality matches "this
 * compaction, fired again" and stops matching a later one.
 *
 * Without it a re-fired `PostCompact` would hand back a budget the new window
 * had already begun to spend, which is a third ask arriving by another door.
 */
test('one compaction returns the budget once, however many times PostCompact fires', () => {
  const sb = sandbox();
  runStop(sb, 99);
  runStop(sb, 99);
  compact(sb);

  assert.notEqual(runStop(sb, 99), '', 'the new window was not asked');
  assert.equal(readLatch(sb.root, sb.session).asks, 1);

  // The SAME compaction, fired again: no new PreCompact, so the snapshot and
  // its `capturedAt` are unchanged.
  const again = compact(sb, { snapshot: false });
  assert.equal(again.outcome?.askBudget, 'same-window');
  assert.equal(readLatch(sb.root, sb.session).asks, 1,
    'a re-fired PostCompact handed back a budget this window had already begun to spend');

  assert.notEqual(runStop(sb, 99), '', 'the second ask of this window was refused');
  assert.equal(runStop(sb, 99.9), '', 'a third ask reached the window through the repeat firing');
});

/**
 * The stamp is brought forward even by a compaction that found nothing to
 * return, so that `same-window` keeps meaning what it says.
 *
 * A compaction that left a STALE marker behind would be indistinguishable from
 * a new window on its own repeat firing — and if an ask had been made in
 * between, that firing would hand back a budget this window had already begun
 * to spend. Which is a third ask arriving by another door, and the bound is the
 * thing this mechanism cannot lose.
 */
test('a compaction with nothing to return still brings the window stamp forward', () => {
  const sb = sandbox();
  runStop(sb, 99);
  runStop(sb, 99);
  compact(sb);

  // A second compaction, with the budget already back and unspent: there is
  // nothing to return, and the marker must still move to THIS window.
  const second = compact(sb);
  assert.equal(second.outcome?.askBudget, 'nothing-asked');
  assert.equal(readLatch(sb.root, sb.session).window, second.capturedAt,
    'the latch kept a marker naming a window that had already been destroyed');

  assert.notEqual(runStop(sb, 99), '', 'the second window was not asked');
  assert.equal(readLatch(sb.root, sb.session).asks, 1);

  const refired = compact(sb, { snapshot: false });
  assert.equal(refired.outcome?.askBudget, 'same-window');
  assert.equal(readLatch(sb.root, sb.session).asks, 1,
    'a stale marker let a repeat firing hand back a budget this window had begun to spend');
});

/* ---------------------------------------------------------------------------
 * A compaction with no snapshot has no window identity.
 * ------------------------------------------------------------------------- */

/**
 * `PreCompact` never ran, so there is no `capturedAt` and nothing can tell the
 * rebuilt window from the one before it. The continuity tier answers a missing
 * identity by OVER-delivering; the ask answers it by asking FEWER times, and
 * the two are the same rule applied to opposite costs — continuity's failure is
 * a session that starts over with nothing, and the ask's is a hook that nags.
 *
 * The direction also has to hold to keep the bound a bound: an event that reset
 * whenever it could not identify a window would turn two asks into unlimited
 * ones the moment identity became unavailable.
 */
test('a compaction with no snapshot returns nothing, and says so', () => {
  const sb = sandbox();
  runStop(sb, 99);
  runStop(sb, 99);
  assert.equal(runStop(sb, 99.9), '', 'the budget was not spent before the compaction');

  const compaction = compact(sb, { snapshot: false });
  assert.equal(compaction.outcome?.askBudget, 'no-identity');
  assert.equal(readLatch(sb.root, sb.session).asks, 2, 'the budget was returned blind');
  assert.equal(runStop(sb, 99.9), '',
    'a compaction that left no snapshot handed out a fresh budget anyway — with no identity ' +
    'nothing bounds how often that can happen');

  // INV-nothing-is-dropped-silently: the row says the budget did NOT come back
  // and why, on the channel that is supposed to be exhaustive.
  assert.match(lastRow(sb, 'post-compact').note ?? '', /ask budget was NOT returned/u);
  assert.match(lastRow(sb, 'post-compact').note ?? '', /no identity/u);
});

/* ---------------------------------------------------------------------------
 * What the reset does NOT touch.
 * ------------------------------------------------------------------------- */

/**
 * `seq:9`'s five verdicts keep their meanings across a reset, and the two that
 * would be easiest to confuse stay apart: a rebuilt window that has not been
 * asked yet is `not-asked`, which is a mechanism nobody engaged — never
 * `ignored`, which is an accusation, and never `unverifiable`, which is a
 * comparison that could not be made.
 */
test('the five verdicts keep their meanings across a reset', () => {
  const sb = sandbox();
  runStop(sb, 99);
  compact(sb);

  // The new window, not yet asked: the ask that was judged at the compaction
  // above belonged to a window that no longer exists, and `PreCompact` already
  // recorded and disclosed its verdict before this reset happened.
  assert.equal(compact(sb).outcome === null, false);
  assert.equal(lastRow(sb, 'pre-compact').handoverAsk, 'not-asked');

  // Asked in the new window and never answered: `ignored`, exactly as before.
  runStop(sb, 99);
  compact(sb);
  assert.equal(lastRow(sb, 'pre-compact').handoverAsk, 'ignored');

  // And a timestamp that will not parse is still `unverifiable`, never folded
  // into `ignored` — an accusation nothing supports is the same defect as a
  // guarantee nothing supports.
  runStop(sb, 99);
  const latch = readLatch(sb.root, sb.session);
  assert.ok(writeLatch(sb.root, sb.session, { ...latch, askedAt: 'not a timestamp' }));
  compact(sb);
  assert.equal(lastRow(sb, 'pre-compact').handoverAsk, 'unverifiable');
});

/**
 * An ask that was ACTED ON is still never repeated inside the window that
 * answered it. The reset returns a budget to a NEW window; it does not re-arm
 * the one whose handover was just written, which is the loop the latch exists
 * to prevent.
 */
test('a satisfied ask is not re-armed inside its own window', () => {
  const sb = sandbox();
  runStop(sb, 99);
  writeHandover(sb);
  assert.equal(runStop(sb, 99.9), '', 'Stop asked again for a handover that had just been written');

  compact(sb);
  assert.notEqual(runStop(sb, 99), '',
    'the window the compaction rebuilt inherited the satisfied latch and was never asked');
});

/**
 * The two once-per-session silences are NOT returned. Both carry their own
 * recorded reasoning on their own fields — `disclosedIgnored` argues outright
 * that a compaction is a genuine reason to repeat the line and that the latch
 * wins anyway — and neither is what the owner ruled on. Returning them here
 * would reopen two decisions under cover of a third.
 */
test('the reset does not reopen the two once-per-session silences', () => {
  const sb = sandbox();
  runStop(sb, 99);

  const disclosed = compact(sb);
  assert.match(disclosed.stderr, /reports\/H\.md/u, 'the ignored ask was never disclosed');
  assert.equal(readLatch(sb.root, sb.session).disclosedIgnored, true);

  runStop(sb, 99);
  const again = compact(sb);
  assert.equal(again.outcome?.askBudget, 'reset');
  assert.equal(again.stderr, '',
    'the reset handed the disclosure back too — a paragraph the user has already read and ' +
    'already declined to act on teaches nothing the second time');
});

/**
 * A workspace that has never been asked acquires no latch file because it was
 * compacted. `state/` holds one file per session per mechanism and a reset that
 * wrote unconditionally would add one to every session in every workspace,
 * including the overwhelming majority with no `handover` key at all.
 */
test('a session that was never asked writes no latch, and no compaction gives it one', () => {
  const off = sandbox({ handoverPath: null });
  assert.equal(runStop(off, 99.9), '');
  const compaction = compact(off);
  assert.equal(compaction.outcome?.askBudget, 'nothing-asked');
  assert.equal(existsSync(latchPath(off.root, off.session)), false,
    'a workspace with no handover configured acquired a latch file by being compacted');
  assert.doesNotMatch(lastRow(off, 'post-compact').note ?? '', /ask budget/u,
    'the row gained a clause about a mechanism this workspace never engaged');

  // Configured, but the threshold was never crossed: same answer.
  const quiet = sandbox();
  assert.equal(runStop(quiet, 40), '');
  assert.equal(compact(quiet).outcome?.askBudget, 'nothing-asked');
  assert.equal(existsSync(latchPath(quiet.root, quiet.session)), false);
});

/**
 * The row says the budget came back, on the channel that is supposed to be
 * exhaustive, and names the window it was handed to. A reset nothing recorded
 * would be a behaviour change invisible in the log — which is the shape of
 * failure `seq:9` was written to end.
 */
test('the post-compact row records the reset and names the window', () => {
  const sb = sandbox();
  runStop(sb, 99);
  runStop(sb, 99);

  const compaction = compact(sb);
  const note = lastRow(sb, 'post-compact').note ?? '';
  assert.match(note, /ask budget was returned/u);
  assert.ok(compaction.capturedAt !== null && note.includes(compaction.capturedAt),
    'the row does not say WHICH window the budget was handed to');
  assert.match(note, /2 ask\(s\) spent/u,
    'the row does not say what the destroyed window had spent');
});
