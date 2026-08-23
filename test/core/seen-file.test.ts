import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { appendJsonlLine } from '../../src/core/jsonl-log.ts';
import { sanitizeSessionId, snapshotPath } from '../../src/core/ledger.ts';
import {
  appendSeen, readSeen, restoredFor, SEEN_APPEND_ATTEMPTS, SEEN_PROTOCOL, seenFilePath, seenIds,
} from '../../src/core/seen-file.ts';
import { removeTree } from '../helpers/tmp.ts';

function root(t: { after(fn: () => void): void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-seen-'));
  t.after(() => removeTree(dir));
  return dir;
}

test('append then read round-trips, ids deduplicated and sorted', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [
    { id: 'CONST-b', tier: 'jit', at: '2026-08-16T10:00:00.000Z' },
    { id: 'CONST-a', tier: 'pinned', at: '2026-08-16T10:00:00.000Z' },
  ]);
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: '2026-08-16T10:01:00.000Z' }]);
  const state = readSeen(dir, 's1');
  assert.equal(state.error, null);
  assert.equal(state.lines.length, 3);
  assert.deepEqual(seenIds(state), ['CONST-a', 'CONST-b']);
});

test('a missing file is an empty seen set, not an error', (t) => {
  const state = readSeen(root(t), 'never-written');
  assert.equal(state.error, null);
  assert.deepEqual(state.lines, []);
});

test('restoredFor is last-line-wins per (id, tier) — recordRestored refresh semantics', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'restored', at: 'GEN-1' }]);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'restored', at: 'GEN-2' }]);
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'GEN-2' }]);
  assert.deepEqual([...restoredFor(readSeen(dir, 's1'), 'GEN-2')], ['CONST-a']);
  // The OLD generation no longer matches — the marker moved, exactly as
  // Ledger.recordRestored's ON CONFLICT ... UPDATE moved it.
  assert.deepEqual([...restoredFor(readSeen(dir, 's1'), 'GEN-1')], []);
});

test('a torn tail is healed by the next append; completed records survive', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  appendFileSync(seenFilePath(dir, 's1'), '{"id":"CONST-tor', 'utf8'); // killed mid-append
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'T1' }]);
  const state = readSeen(dir, 's1');
  assert.equal(state.error, null);
  assert.deepEqual(seenIds(state), ['CONST-a', 'CONST-b']);
});

test('a corrupt middle line degrades to error, never throws — inject-without-dedupe direction', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  appendFileSync(seenFilePath(dir, 's1'), 'not json at all\n', 'utf8');
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'T1' }]);
  const state = readSeen(dir, 's1');
  assert.notEqual(state.error, null);
  assert.deepEqual(state.lines, []); // no partial answer: dedupe is all-or-disclosed
});

test('a well-formed line missing a required field degrades to error, never a guessed record', (t) => {
  // Valid JSON with the right protocol but a missing/mistyped field is not a
  // torn tail — it is corruption or version skew, and treating it as a record
  // would hand dedupe an `undefined` id. Each field's guard is pinned in its
  // own file so a surviving mutant names the field it lost.
  const cases: Array<[string, string]> = [
    ['no-id', '{"protocol":"mycontext-seen/1","tier":"jit","at":"T0"}\n'],
    ['bad-tier', '{"protocol":"mycontext-seen/1","id":"CONST-a","tier":"bogus","at":"T0"}\n'],
    ['no-at', '{"protocol":"mycontext-seen/1","id":"CONST-a","tier":"jit"}\n'],
  ];
  for (const [key, line] of cases) {
    const dir = root(t);
    appendSeen(dir, key, [{ id: 'CONST-ok', tier: 'jit', at: 'T0' }]);
    appendFileSync(seenFilePath(dir, key), line, 'utf8');
    appendSeen(dir, key, [{ id: 'CONST-later', tier: 'jit', at: 'T1' }]);
    const state = readSeen(dir, key);
    assert.notEqual(state.error, null, `${key}: the damaged line must be refused, not guessed at`);
    assert.deepEqual(state.lines, [], `${key}: no partial answer — dedupe is all-or-disclosed`);
  }
});

test('the key is sanitized into the filename exactly as snapshot paths are', (t) => {
  const dir = root(t);
  const file = seenFilePath(dir, 'sess::agent');
  // A folded key carries a digest of its raw spelling — see the decision
  // records below. The stem must be the SAME one the restore snapshots use:
  // one sanitizer, one equivalence class per key, never two.
  assert.match(file, /[\\/]sess__agent-[0-9a-f]{12}\.seen\.jsonl$/);
  assert.equal(
    basename(snapshotPath(dir, 'sess::agent'), '.restore.json'),
    basename(file, '.seen.jsonl'),
  );
});

// --- The collision decision records ----------------------------------------
//
// The 2026-08-16 task-3-4 review executed four collision shapes the folding
// sanitizer admitted: `a::b`↔`a__b`, 128-char truncation (which folded a
// parent key into EVERY `::agent` key of the same live session — the exact
// per-window suppression E2 was fixed to eliminate), case-variant ids on a
// case-insensitive filesystem, and the leading-dot fold. All four were
// unreachable with real UUID session ids — but that is a fact about Claude
// Code's current id format, not about this code, and nothing pinned it. The
// DECISION, recorded here: the sanitizer is injective (modulo a 48-bit
// digest collision) for every input, so no shape is left to the id format.

test('DECISION: a::b and a__b no longer collide — the digest preserves raw-string distinctness', (t) => {
  const dir = root(t);
  appendSeen(dir, 'a::b', [{ id: 'CONST-x', tier: 'jit', at: 'T0' }]);
  assert.deepEqual(seenIds(readSeen(dir, 'a__b')), []);
  assert.deepEqual(seenIds(readSeen(dir, 'a::b')), ['CONST-x']);
});

test('DECISION: truncation cannot fold a parent key into its subagent keys (the E2 shape)', (t) => {
  const dir = root(t);
  const long = `sess-${'x'.repeat(200)}`; // past the 128-char filename cap
  const sub = `${long}::agent-7`;
  assert.notEqual(seenFilePath(dir, long), seenFilePath(dir, sub));
  assert.notEqual(seenFilePath(dir, `${long}::agent-7`), seenFilePath(dir, `${long}::agent-8`));
  assert.ok(sanitizeSessionId(long).length <= 128, 'sanitized names must stay filename-sized');
  // A subagent's fresh context window must get a fresh dedupe scope: the
  // parent's deliveries must not read as its own.
  appendSeen(dir, long, [{ id: 'CONST-parent', tier: 'jit', at: 'T0' }]);
  assert.deepEqual(seenIds(readSeen(dir, sub)), []);
});

test('DECISION: case-variant ids stay distinct even on a case-insensitive filesystem', (t) => {
  const dir = root(t);
  // An id containing uppercase never passes through bare — it takes the
  // digest suffix, and digests are lowercase hex, so two case-variant raws
  // differ in character VALUE, which NTFS/APFS case-folding cannot conflate.
  assert.notEqual(sanitizeSessionId('SessABC'), 'SessABC');
  assert.notEqual(
    sanitizeSessionId('SessABC').toLowerCase(),
    sanitizeSessionId('SESSABC').toLowerCase(),
  );
  // And on THIS filesystem, whatever its case sensitivity:
  appendSeen(dir, 'SessABC', [{ id: 'CONST-x', tier: 'jit', at: 'T0' }]);
  assert.deepEqual(seenIds(readSeen(dir, 'sessabc')), []);
});

test('DECISION: the leading-dot fold no longer conflates .a, ..a and _a', () => {
  const distinct = new Set(['.a', '..a', '_a'].map((k) => sanitizeSessionId(k)));
  assert.equal(distinct.size, 3);
});

test('a canonical id — a real lowercase UUID — passes through byte-stable', () => {
  // Filename stability for the ids Claude Code actually sends: existing
  // sessions must not have their dedupe state orphaned by this change.
  const uuid = '3f2c9d1e-8a4b-4c6d-9e0f-123456789abc';
  assert.equal(sanitizeSessionId(uuid), uuid);
});

test('the seen append retry budget is hot-path patience that fits the hook kill window', () => {
  // `retryOnTransientFsError` sleeps 20·(attempt+1) ms after each failed
  // attempt, so k attempts back off for at most 10·k·(k-1) ms PER LINE — and
  // unlike the snapshot rename, appendSeen retries per line, so its worst
  // case scales with the number of items delivered: every line can exhaust
  // its backoff and still succeed. This pins the budget the way
  // SNAPSHOT_RENAME_ATTEMPTS is pinned, so neither the constant nor the
  // backoff formula can drift silently. If the formula in rebuild.ts
  // changes, re-derive the budget rather than deleting this test.
  const perLineWorstMs = 10 * SEEN_APPEND_ATTEMPTS * (SEEN_APPEND_ATTEMPTS - 1);
  assert.ok(perLineWorstMs >= 100,
    `seen append backoff ${perLineWorstMs}ms cannot outlast a scanner's momentary hold`);
  assert.ok(perLineWorstMs <= 250,
    `seen append backoff ${perLineWorstMs}ms is compaction-time patience on a hot path`);
  // 40 lines is ~4x the largest single delivery observed in this project;
  // even that pathological append must leave at least 2s of the 10s hook
  // kill (hooks.json) for the store open, select and render that precede it.
  assert.ok(40 * perLineWorstMs <= 8000,
    `a 40-line append could back off ${40 * perLineWorstMs}ms — too close to the 10s hook kill`);
});

test('the append retry budget is wired, not just declared: effective backoff is MEASURED', (t) => {
  // The static band above pins the CONSTANT's value; this pins that appendSeen
  // actually retries with that constant and the documented formula. A
  // read-only seen file makes every attempt fail EPERM (Windows) / EACCES
  // (POSIX) — both in TRANSIENT_RENAME_CODES, verified by execution — so the
  // real retry loop runs to exhaustion and its total backoff can be measured.
  // This is what makes dropping the explicit attempts argument SAFE rather
  // than a silent value coincidence with retryOnTransientFsError's default:
  // if the effective attempt count ever drifts (a changed default with the
  // argument dropped, a changed backoff formula), the measured time leaves
  // this band and the suite goes red — the drift cannot be silent.
  //
  // ── WHAT IS MEASURED, AND WHY THE CEILING IS GATED RATHER THAN RAISED ────
  //
  // The band is UNCHANGED: [0.75x, 2x) of the declared 200ms budget. It is a
  // real latency claim and not a stylistic one — appendSeen is on the hook hot
  // path, and the static test above admits a 40-line append inside the 10s
  // hook kill purely on the strength of 200ms per line. The 2x ceiling is also
  // the exact value that separates 5 attempts (200ms declared, ~240ms measured
  // on a quiet box) from the next count this instrument can see, 7, at 420ms.
  // Raising the ceiling to 4x — 800ms — would stop catching a 7-attempt drift
  // altogether and only ever catch a doubled count at 900ms. So the ceiling is
  // KEPT at 400ms, and it is the SAMPLE that is qualified instead.
  //
  // What was wrong before was never the number, it was the sample. `elapsed`
  // is backoff PLUS whatever the box took away, and this suite takes away a
  // lot: `node --test` runs test FILES concurrently (20 workers on this
  // machine) and many of them spawn children, so all five failing attempts —
  // ensureLogDir, healTornTail, appendFileSync, real I/O against a contended
  // temp directory — and all four sleeps between them can be descheduled.
  // Measured 2026-08-23 with one full suite running alongside, 185 samples:
  // min 231ms, median 546ms, p90 1073ms, max 2198ms. Best-of-N does not rescue
  // that, because the noise is not independent between samples — it is a busy
  // machine for seconds at a time: best-of-5 exceeded 400ms in 51% of runs and
  // best-of-9 in 17%, and the old best-of-3 failed 9 of 10 full-suite runs
  // under load, at 451, 509, 514, 550, 556, 644, 653, 721 and 888ms.
  //
  // So the drift is caught TWICE, by two readings of the same samples, because
  // one of them can be taken on any machine and the other cannot:
  //
  //   1. **Against the reference, always.** `timeReference` is this test's own
  //      restatement of the retry loop — the same attempts refused the same
  //      way, the same 20·(attempt+1) sleeps between them — written out here
  //      rather than imported, so a changed formula in rebuild.ts moves
  //      `elapsed` and NOT the reference. Both are hit by the same machine at
  //      the same moment, so the DIFFERENCE between them is about the wiring
  //      and not about the load. Going from 5 attempts to 7 adds 20·5 + 20·6 =
  //      220ms of declared backoff, and the QUIETEST of MIN_SAMPLES pairings
  //      is what reads it. Measured over 25 runs under two concurrent suites:
  //      on correct wiring that quietest pairing never exceeded +31ms, and at
  //      7 attempts it reached DRIFT_MS in 22 of the 25. This half is asserted
  //      on every run, loaded or not.
  //   2. **Against the 400ms ceiling, when the box can still be read.** A
  //      reference reading at or under READABLE_MS is the machine saying a
  //      200ms budget is legible in this window. In such a window, across
  //      those same samples, the real measurement never exceeded 381ms — and
  //      never exceeded 266ms once two admitted readings were taken and the
  //      smaller kept. This is the absolute latency claim, and it is the one
  //      that also catches a formula that scaled everything up together, which
  //      (1) cannot see because the reference would scale with it.
  //
  // What this does not see when it reports green: on a machine so loaded that
  // no admitted reading turns up within SAMPLE_BUDGET_MS, claim (2) is not
  // evaluated at all, and the test says so in a diagnostic rather than
  // reporting machine load as a wiring defect. Claim (1) still runs. The floor
  // runs either way — load can only ever make `elapsed` LARGER, so a reading
  // under the floor is a real regression on any machine, and the floor is the
  // half of the band that catches a REDUCED attempt count or a shortened
  // formula.
  const perLineWorstMs = 10 * SEEN_APPEND_ATTEMPTS * (SEEN_APPEND_ATTEMPTS - 1);
  /** A reference reading at or under this says the box can still be read. */
  const READABLE_MS = perLineWorstMs * 1.4;
  /** Two admitted readings are enough, and the smaller of them is kept. */
  const ADMITTED_WANTED = 2;
  /**
   * How much slower than its own reference the real loop may be on the
   * quietest pairing of a run. Two extra attempts would declare 220ms more
   * backoff, so this sits below that and well above the +31ms the quietest
   * pairing ever reached on correct wiring under two concurrent suites.
   */
  const DRIFT_MS = 150;
  /**
   * Enough pairings that the quietest of them means something. Three was not:
   * a full-suite run on 2026-08-23 stalled hard enough that each pairing took
   * ~3.5s, all three were hit, and the quietest still read +524ms — a red that
   * was the machine and nothing else. At five, measured over 25 runs under two
   * concurrent suites, the quietest pairing never once exceeded +31ms on
   * correct wiring, and reached DRIFT_MS in 22 of 25 runs at 7 attempts.
   */
  const MIN_SAMPLES = 5;
  /** Stop hunting for a legible window after this long, and report that. */
  const SAMPLE_BUDGET_MS = 6_000;

  const dir = root(t);
  appendSeen(dir, 'locked', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  const file = seenFilePath(dir, 'locked');
  const logDir = dirname(file);

  /**
   * The declared budget re-derived from the formula rather than from the
   * closed form, so the two statements of it have to agree with each other.
   */
  function referenceBudgetMs(attempts: number): number {
    let total = 0;
    for (let attempt = 0; attempt < attempts - 1; attempt += 1) total += 20 * (attempt + 1);
    return total;
  }
  assert.equal(referenceBudgetMs(SEEN_APPEND_ATTEMPTS), perLineWorstMs);

  /**
   * The same work the real loop does, timed: `attempts` appends that must all
   * be refused, with the declared sleep between them. Deliberately NOT built
   * on `retryOnTransientFsError` — a reference has to stay put while the thing
   * under test moves, or it absorbs the very drift this test exists to catch.
   * Returns the refusal count so the caller can prove, once the file is
   * writable again, that the reference really did fail every attempt.
   */
  function timeReference(attempts: number): { took: number; refusals: number } {
    const started = Date.now();
    let refusals = 0;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        appendJsonlLine(logDir, file, {
          protocol: SEEN_PROTOCOL, id: 'CONST-ref', tier: 'jit', at: 'REF',
        });
      } catch { refusals += 1; }
      if (attempt < attempts - 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * (attempt + 1));
      }
    }
    return { took: Date.now() - started, refusals };
  }

  /** A measurement plus the two reference readings that bracketed it. */
  const admitted: Array<{ took: number; before: number; after: number }> = [];
  const every: number[] = [];
  const references: number[] = [];
  const excess: number[] = [];
  let refusalsSeen = 0;
  let written = true;
  let referencesTaken = 0;
  /** One timed reference, with the file read-only for the whole of it. */
  const reference = (): number => {
    chmodSync(file, 0o444);
    const taken = timeReference(SEEN_APPEND_ATTEMPTS);
    chmodSync(file, 0o666); // before any assert can throw past it — cleanup must not fail
    refusalsSeen += taken.refusals;
    referencesTaken += 1;
    references.push(taken.took);
    return taken.took;
  };

  // Every measurement is BRACKETED by a reference, and admitted only when the
  // box was legible on BOTH sides of it. A single leading reference is not
  // enough: measured here on 2026-08-23, a 279ms reference was followed
  // immediately by an 814ms measurement when a stall landed in between, which
  // is precisely the false red this gate exists to prevent. Each trailing
  // reference is the next sample's leading one, so the bracket costs one extra
  // reading for the whole run rather than one per sample.
  let before = reference();
  const deadline = Date.now() + SAMPLE_BUDGET_MS;
  do {
    chmodSync(file, 0o444);
    const started = Date.now();
    const result = appendSeen(dir, 'locked', [{ id: 'CONST-b', tier: 'jit', at: 'T1' }]);
    const took = Date.now() - started;
    chmodSync(file, 0o666); // before any assert can throw past it — cleanup must not fail
    written = written && result.written;
    every.push(took);
    excess.push(took - before);
    const after = reference();
    if (before <= READABLE_MS && after <= READABLE_MS) admitted.push({ took, before, after });
    before = after;
  } while (every.length < MIN_SAMPLES
    || (admitted.length < ADMITTED_WANTED && Date.now() < deadline));

  const samples = every.length;
  assert.equal(written, false);
  assert.equal(refusalsSeen, referencesTaken * SEEN_APPEND_ATTEMPTS,
    'the reference did not fail every attempt — it is not doing the work it stands in for');

  // The floor takes the best reading of them all: load only ever inflates, so
  // the smallest sample is the closest any of them got to the truth.
  const elapsed = Math.min(...every);
  assert.ok(elapsed >= perLineWorstMs * 0.75,
    `measured ${elapsed}ms of backoff over ${samples} sample(s) — `
    + `the declared ${perLineWorstMs}ms budget is not wired in`);

  // Claim 1, on any machine: the real loop is not more patient than this
  // test's own statement of the declared budget. Read on the QUIETEST pairing
  // of the run — in every other pairing the reference and the measurement were
  // hit by the busy machine in different amounts, and their difference says
  // more about the machine than about the wiring.
  const overReference = Math.min(...excess);
  assert.ok(overReference < DRIFT_MS,
    `appendSeen took ${overReference}ms longer than the ${perLineWorstMs}ms budget written out `
    + `here, on the quietest of ${samples} pairing(s) — more attempts, or a longer sleep between `
    + `them, than SEEN_APPEND_ATTEMPTS and the documented formula declare`);

  // Claim 2, only where the box can still be read.
  if (admitted.length === 0) {
    t.diagnostic(
      `the ${perLineWorstMs * 2}ms ceiling was NOT evaluated: none of ${samples} measurement(s) in `
      + `${SAMPLE_BUDGET_MS}ms was bracketed by two references BOTH at or under ${READABLE_MS}ms, `
      + `so this box was too loaded to read a ${perLineWorstMs}ms budget. Best reference `
      + `${Math.min(...references)}ms, best measurement ${elapsed}ms, `
      + `${overReference}ms over the reference.`);
    return;
  }
  const kept = admitted.reduce((best, one) => (one.took < best.took ? one : best));
  assert.ok(kept.took < perLineWorstMs * 2,
    `measured ${kept.took}ms of backoff — more patience than the declared ${perLineWorstMs}ms `
    + `budget. This reading is not machine load: the reference did the same work either side of `
    + `it, in ${kept.before}ms and ${kept.after}ms, both at or under the ${READABLE_MS}ms that `
    + `says the box is legible.`);
});
