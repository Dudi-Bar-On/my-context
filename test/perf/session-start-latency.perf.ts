/**
 * Perf suite — see the header comment in `jit-latency.perf.ts` for why this
 * lives here (`.perf.ts`, not `.test.ts`) and runs only under
 * `npm run test:perf` (`--test-concurrency=1`).
 *
 * This replaces the single-sample "hook completes within the latency
 * ceiling on a large corpus" test that used to live in
 * `test/hooks/session-start.test.ts`. That test took one wall-clock
 * measurement inside `node --test`'s default *concurrent* runner — with
 * ~280 other tests competing for cores it measured ~674ms against its
 * 500ms ceiling, and passed comfortably run alone. It was flaky by
 * construction: failing for a reason unrelated to the code under test.
 *
 * The 500ms budget itself is correct and unchanged from the plan: it is
 * SessionStart's budget (once per session, full disk rebuild of the whole
 * corpus from Markdown), not the JIT hook's 50ms per-tool-call budget.
 * `buildSessionStartOutput` is exercised here across many iterations with
 * no session id, so it performs the same full rebuild every call with no
 * ledger state carried between iterations — the true steady-state cost.
 *
 * ── The statistic, and why it is a percentile rather than a maximum ──────
 *
 * Until 2026-08-23 every assertion in this file called itself a p95 and
 * computed a MAXIMUM. The local `p95` helper indexed `floor(n * 0.95)`,
 * which is the LAST index of the sorted array whenever `0.05 * n <= 1` —
 * that is, for every `n <= 20` — and `ITERATIONS` was exactly 20. So each
 * "p95" was the single worst of twenty runs; `p95` and `max` were observed
 * printing the identical 5167.7ms. One GC pause, one disk stall, or one
 * descheduled iteration reddened the file, which is why it was described as
 * failing locally and passing on CI: intolerant of a single outlier by
 * construction, and a development box is noisier than a quiet runner.
 *
 * **Resolved by making the statistic match its name, not by renaming the
 * ceilings to "max".** The deciding question is what the gate is FOR:
 *
 *   - Nothing in the product promises that no individual SessionStart ever
 *     exceeds 500ms. 500ms is a per-session budget for a hook that fires
 *     once per session, and one descheduled iteration inside an in-process
 *     measurement loop is not a user-visible event at all.
 *   - What this gate exists to catch is a REGRESSION: a change that moves
 *     the whole distribution — an accidental O(n) rescan per call, a
 *     per-call process spawn, the 16.9s lock-stall class E4 fixed.
 *     `test/helpers/perf.ts` says the same in its own words ("certifies the
 *     absence of order-of-magnitude regressions"), and this header already
 *     instructed the reader to compare readings run over run.
 *   - A regression detector wants a STABLE statistic. A maximum is the least
 *     stable one available, and uniquely it gets worse the harder you
 *     measure: E[max] rises with the sample count, so honest extra sampling
 *     makes a max-based gate redder. That is the ratchet that ends with
 *     somebody widening a ceiling until the gate can no longer fail.
 *
 * So `percentile` is nearest-rank (`ceil(n * q) - 1`, never `floor(n * q)`)
 * and `ITERATIONS` is 100. At n=100 the p95 is the 95th of 100 sorted
 * samples with FIVE samples above it — the smallest count at which a 95th
 * percentile is an order statistic with a real tail over it instead of a
 * synonym for the maximum. 100 rather than the 200 that `jit-latency`,
 * `focus-latency` and `audit-latency` use because one iteration here is a
 * full 500-item corpus rebuild (tens of ms) rather than one hook call
 * (single-digit ms); 200 would roughly triple this file's wall clock to
 * sharpen an estimate that is already an order statistic. The last test
 * below pins that property so the file cannot quietly regress to a max
 * again.
 *
 * **The 500ms ceiling was NOT changed.** Widening a ceiling to quiet a noisy
 * statistic is the failure this change exists to remove, not a substitute
 * for it.
 *
 * What a green run does NOT certify, stated so nobody reads more into it:
 * a regression that afflicts fewer than ~5% of calls will not move the p95.
 * `max` is therefore still measured and still printed, in the console line
 * and in the failure message — diagnostic, not the verdict. Read a red run
 * by its SHAPE: every statistic up together → the machine, re-run; p95 and
 * max up while the median holds → tail noise, re-run; the MEDIAN moved →
 * the code, investigate before any retry.
 *
 * ── Recorded baselines ──────────────────────────────────────────────────
 *
 * Everything recorded before 2026-08-23 was a max-of-20, and is kept here
 * relabelled rather than deleted — it remains the best record of how this
 * shape's worst case moved, and it is NOT comparable with a p95:
 *
 *   2026-08-13, dev machine, before the never-miss reorder:
 *     plain max-of-20 ~54.9–55.5ms; compact ~123.9ms.
 *   2026-08-16, dev machine, two runs:
 *     plain max-of-20 ~45.6–46.3ms; compact ~149.1–163.6ms. The fall in the
 *     plain shape matches the design's prediction — selection no longer
 *     waits on the write transaction (plan Task 5). The rise in the compact
 *     shape is the restore path's new work: the seen-file restore marker and
 *     the best-effort index refresh both run per call in that shape.
 *   2026-08-21, dev machine with five worktrees' suites running:
 *     sweepless max-of-20 218.9 and 266.1ms; with-sweep 234.0 and 383.4ms.
 *     `pruneSnapshots` measured in isolation over 200 fresh entries: 3.1,
 *     3.5, 4.0, 4.1, 4.3ms.
 *
 * First p95-of-100 figures, and the conditions they were taken under —
 * 2026-08-23, same dev machine (20 logical cores, i9-13900H), DELIBERATELY
 * NOT IDLE: sixteen agents were working this tree, 100–120 concurrent `node`
 * processes were resident and the box sat at 100% CPU. A probe in the same
 * window timed single `buildSessionStartOutput` calls at 1254, 1687, 2055,
 * 2235, 3016, 4239, 5270 and 5695ms against the 45ms idle baseline above.
 * Sampled at n=120 per shape (all figures in ms):
 *
 *   plain     min 504.4  median  861.9  p90 2139.0  p95 2868.5  max 3920.8
 *   compact   min 620.6  median 1066.8  p90 3602.4  p95 5385.5  max 7017.4
 *   compact   min 596.0  median 1446.3  p90 6105.7  p95 7640.6  max 9496.4
 *             (the same shape again minutes later — the run-to-run spread of
 *              this shape under load is four times the entire budget)
 *   +sweep    min 513.2  median 1787.4  p90 5420.7  p95 6867.4  max 8838.4
 *   `pruneSnapshots` alone over the same 200 fresh entries, n=40:
 *             min   7.6  median   11.1              p95   12.6  max   15.3
 *
 * And the gate itself, run end to end on the same box an hour later — all
 * three timing tests RED, correctly and for the machine rather than for the
 * code (every statistic up together, median included):
 *
 *   plain     min 377.4  median  662.9              p95 4413.6  max  7981.7
 *   compact   min 426.9  median  706.0              p95 6228.7  max 10361.8
 *   +sweep    min 541.6  median 1269.3              p95 5246.7  max  7871.2
 *
 * That run cost 556s of wall clock for the file, against roughly 45s if the
 * per-call costs were the idle ones — the ~12× is the load, not the count.
 *
 * Read those honestly: they are 40–60× the idle baselines, the plain shape's
 * MINIMUM sample (504.4ms) is already over the 500ms ceiling, and no choice
 * of statistic rescues a measurement taken there. That is precisely the
 * "every statistic up together → the machine" reading, and the response is
 * to re-measure somewhere quieter — never to widen the ceiling to fit.
 *
 * Those same pools also measure what the change bought, by resampling them.
 * On the plain pool the OLD max-of-20 estimator lands anywhere in
 * 1056–3921ms run to run on IDENTICAL code (a 3.7× spread); p95-of-100 lands
 * in 1838–3432ms (1.9×). On the compact pool: 1616–7017ms (4.3×) against
 * 2399–5566ms (2.3×). Resampling at 200 rather than 100 narrows the plain
 * spread only from 1.9× to 1.7×, which is what decided 100 over 200. And
 * max-of-20 and the old floor-indexed "p95-of-20" returned the identical
 * median and the identical worst case on both pools — the defect restated as
 * a measurement rather than as arithmetic.
 *
 * An idle-machine p95-of-100 re-derivation is still owed; take it before
 * reading any of these as a regression signal, and record it here beside
 * them rather than over them.
 *
 * ── Watched failing, 2026-08-23 ─────────────────────────────────────────
 *
 * A gate nobody has watched fail is not a gate. Four runs on the loaded
 * machine described above, against the real UNWIDENED 500ms ceiling, with
 * `CORPUS_SIZE` temporarily at 25 for the first three — on a box where the
 * 500-item shape's *minimum* sample is 504ms no control run can be green at
 * all, and a proof needs a green control. Every edit reverted afterwards:
 *
 *   control, unmodified        p95   51.6ms  median  47.4  max  247.0  PASS
 *   12× the work per call      p95 2236.6ms  median 863.0  max 3351.5  FAIL
 *   ONE iteration given 40×    p95  204.8ms  median  64.7  max 3183.7  PASS
 *   `ITERATIONS` back to 20    the guard test below FAILS — "only 1 of 20
 *                              samples sit above the p95"
 *
 * Rows two and three are the entire argument, side by side. A regression
 * that moves the DISTRIBUTION is caught, and the median moves with it,
 * which is the signature the reading rule above says to look for. A single
 * 3183.7ms outlier — 66× the median — does not redden the gate, where the
 * old max-of-20 would have reported that one sample as the "p95" and failed
 * the build on it.
 *
 * The same pair again at `CORPUS_SIZE` 5, which is also how the `t.after`
 * cleanup below was checked rather than assumed: control p95 294.3ms
 * (median 89.4) PASS, 20× the work per call p95 1861.1ms (median 599.2)
 * FAIL — and the count of `myctx-perf-session-*` directories in the temp
 * directory was unchanged by BOTH runs, the red one included.
 *
 * The THIRD test below covers what Task 12 added after the write to stdout:
 * the `state/` sweep. See its own docblock for why it recomposes the entry
 * guard's pair rather than spawning the binary, and why its 200 fixture files
 * are fresh rather than stale.
 *
 * The second test below covers the compact/restore branch this one
 * deliberately skips (no session id): with a session id and a real snapshot
 * present. See that test's own docblock for the two conditions (a normative
 * corpus, a fresh session/snapshot per iteration) this depends on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { writeItem } from '../../src/core/rebuild.ts';
import { pruneSnapshots, writeSnapshot } from '../../src/core/ledger.ts';
import { SEEN_FILE_SUFFIX } from '../../src/core/seen-file.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';

const CORPUS_SIZE = 500;
/** The `state/` fixture for the sweep case below: 200 entries, all inside the retention window. */
const STATE_FILES = 200;
const WARMUP = 3;
/**
 * 100, not 20. See "The statistic" in the header: at 20 samples the 95th
 * percentile is the maximum as this file used to index it, and a maximum with
 * one sample above it even indexed correctly. The count is therefore part of
 * the assertion's MEANING rather than a tuning knob, and the last test in this
 * file fails if it drops back below the point where the p95 has a tail.
 */
const ITERATIONS = 100;
/** The quantile every ceiling in this file is asserted at. */
const PERCENTILE = 0.95;
// 500ms is the product budget; widened 10× on the GitHub Windows runner only
// (an 819ms breach was observed there on unchanged code, run 31674652091) —
// see test/helpers/perf.ts for what the widened ceiling certifies.
const CEILING_MS = perfCeiling(500);

function lesson(i: number): Item {
  return {
    id: `LESSON-${i}`, type: 'lesson', title: `Lesson number ${i}`, status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: '', extra: {},
    body: 'A body of roughly forty characters.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/lesson/LESSON-${i}.md`,
  };
}

/**
 * Unlike `lesson`, `type: 'constraint'` is a NORMATIVE category (see
 * `src/core/categories.ts`) — only normative items ever pass `isNormative`
 * and become eligible for `selection.full` in `select.ts`. The compact perf
 * case below needs restored items to actually land in `full` (so
 * `recordRestored` runs on the timed path); a `lesson` corpus could never do
 * that regardless of `always` or the restore ids passed in, since rationale
 * items are excluded from full injection entirely.
 */
function constraintItem(i: number): Item {
  return {
    id: `CONST-${i}`, type: 'constraint', title: `Constraint number ${i}`, status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: '', extra: {},
    body: 'A body of roughly forty characters.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/constraint/CONST-${i}.md`,
  };
}

/**
 * Nearest-rank percentile of an ALREADY SORTED ascending array: the smallest
 * sample with at least a `q` fraction of the distribution at or below it.
 *
 * `ceil(n * q) - 1`, deliberately not `floor(n * q)`. The floor form is what
 * turned every ceiling in this file into a max-of-20: it indexes the last
 * element whenever `(1 - q) * n <= 1`, and it is off by one high everywhere
 * else too (at n=200 it returns the 191st of 200, not the 190th).
 */
function percentile(sorted: readonly number[], q: number): number {
  const index = Math.ceil(sorted.length * q) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

interface Distribution {
  readonly n: number;
  readonly min: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
}

/**
 * The whole shape, not just the number being asserted. The median is what
 * separates "this machine is slow" from "this code is slow", and the max is
 * kept visible so the outlier information the old max-based assertion carried
 * is not lost — it simply no longer decides the verdict.
 */
function summarize(samples: readonly number[]): Distribution {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0],
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, PERCENTILE),
    max: sorted[sorted.length - 1],
  };
}

function report(label: string, d: Distribution): string {
  return (
    `${label} p95 ${d.p95.toFixed(1)}ms over ${d.n} samples ` +
    `(min ${d.min.toFixed(1)}, median ${d.median.toFixed(1)}, max ${d.max.toFixed(1)}ms) ` +
    `against a ${CEILING_MS}ms ceiling`
  );
}

test('SessionStart stays under the 500ms p95 ceiling on a 500-item corpus rebuild', (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-session-'));
  // Registered before anything can throw: a perf gate is BUILT to go red, and
  // a cleanup line placed after the assertion leaks a 500-item corpus into the
  // temp directory on exactly the runs that matter. Sixty-odd such directories
  // sitting in `%TEMP%`, the oldest four days old, are how it was noticed.
  t.after(() => removeTree(cwd));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  // Written straight to disk (not through the CLI's `add`) so corpus setup
  // is a one-time cost rather than 500 CLI invocations — the hook itself
  // still does the real work: reading and parsing every file on every call.
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(ws.projectRoot!, lesson(i));

  // Warm-up: lazy module init and cold file-cache reads are real cost but a
  // one-time one — not what the per-call ceiling is meant to protect.
  for (let i = 0; i < WARMUP; i++) buildSessionStartOutput(cwd);

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    buildSessionStartOutput(cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = summarize(samples);
  console.log(report('session-start', measured));
  assert.ok(measured.p95 < CEILING_MS, report('session-start', measured));
});

/**
 * The test above passes no session id, so it never takes the branch a real
 * SessionStart(compact) firing does: the snapshot read, the seen-file read
 * (`readSeen`/`restoredFor`), and the seen-file append are all skipped.
 * (Before the never-miss reorder this branch went through `Ledger.open`/
 * `entries()`/`recordRestored()`; SessionStart no longer touches the
 * ledger at all — dedupe state lives in the per-session seen file.) This
 * exercises the compact branch directly.
 *
 * Two things had to be genuinely true, not just claimed, for the restore
 * marker to actually land on the timed path — both were checked by
 * instrumentation before settling on this shape:
 *
 * 1. The restored ids must resolve to items in a NORMATIVE category. The
 *    corpus below uses `constraint` items (see `constraintItem`), not the
 *    `lesson` corpus the test above uses — `lesson` is a rationale category,
 *    permanently ineligible for `selection.full` regardless of `always` or
 *    the restore ids passed in, so the restore branch would never carry
 *    items no matter how the session/snapshot were varied.
 * 2. The session and its snapshot must be fresh on every iteration, not
 *    reused. The restore dedupe is identity-based (`restoredFor` matches
 *    seen lines against the snapshot's own `capturedAt`), so reusing one
 *    session/snapshot would make every call after the first see its own
 *    prior seen-file append as "already restored for this generation" —
 *    `restore` would collapse to `[]` on every iteration but the first.
 *
 * `writeSnapshot` runs OUTSIDE the timed window on every iteration, so the
 * hundred snapshots this now leaves in `state/` cost the measurement
 * nothing: `buildSessionStartOutput` reads one snapshot by session id
 * (`readSnapshotMeta`) and never lists the directory, so the per-call cost
 * does not grow with the iteration count. That is worth stating because it
 * is the property that lets the sample count be raised at all.
 */
test('SessionStart(compact) with a session id and a snapshot stays under the 500ms p95 ceiling', (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-compact-'));
  t.after(() => removeTree(cwd));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(ws.projectRoot!, constraintItem(i));

  const restoredIds = Array.from({ length: 50 }, (_, i) => `CONST-${i}`);

  /** A brand-new session with its own freshly-captured snapshot, so this call's `restore` is never pre-emptied by a previous iteration's seen-file append. */
  function freshCompactOptions(label: string): { source: string; sessionId: string } {
    const sessionId = `perf-compact-${label}`;
    writeSnapshot(ws.projectRoot!, sessionId, restoredIds);
    return { source: 'compact', sessionId };
  }

  for (let i = 0; i < WARMUP; i++) buildSessionStartOutput(cwd, freshCompactOptions(`warmup-${i}`));

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const options = freshCompactOptions(`run-${i}`);
    const started = process.hrtime.bigint();
    buildSessionStartOutput(cwd, options);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = summarize(samples);
  console.log(report('session-start(compact)', measured));
  assert.ok(measured.p95 < CEILING_MS, report('session-start(compact)', measured));
});

/**
 * Task 12 put a `state/` sweep in the SessionStart ENTRY GUARD, immediately
 * after the write to stdout — so it is not reachable from
 * `buildSessionStartOutput`, which is the point: the model already has its
 * text before the sweep starts. This test therefore times the guard's PAIR, in
 * the guard's order (build, then `pruneSnapshots`), rather than spawning the
 * binary. A spawn would measure a cold `node` start type-stripping the whole
 * injection graph — tens of times the cost being bounded here, and a
 * measurement of the machine rather than of the sweep.
 *
 * **The 200 fixture entries are FRESH, not stale**, which is both the honest
 * case and the expensive one. `pruneSnapshots` is a `readdirSync` plus one
 * `statSync` per matching entry; nothing is removed here, so that scan runs in
 * full on every iteration and the directory still holds 200 files at the last
 * one. A stale fixture would delete itself on the first call and leave every
 * remaining iteration measuring an empty directory — a number that would pass
 * while asserting nothing. The assertion below checks the fixture survived,
 * because that is not something a timing number can tell you.
 *
 * The sweep's own share is too small to read out of the pair on a shared
 * machine — the spread between two runs of the SAME shape has repeatedly been
 * larger than anything the sweep could contribute — so it was measured
 * directly instead, in isolation: `pruneSnapshots` over 200 fresh entries took
 * 3.1, 3.5, 4.0, 4.1 and 4.3ms (2026-08-21). Single-digit milliseconds at 200
 * entries, measured rather than assumed, which is what Step 4 of the plan
 * asked for.
 */
test('SessionStart plus its state/ sweep stays under the 500ms p95 ceiling with 200 state entries', (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-sweep-'));
  t.after(() => removeTree(cwd));
  runCli(['init'], cwd, () => {});

  const root = resolveWorkspace(cwd).projectRoot!;
  for (let i = 0; i < CORPUS_SIZE; i++) writeItem(root, lesson(i));

  const stateDir = path.join(root, 'state');
  mkdirSync(stateDir, { recursive: true });
  for (let i = 0; i < STATE_FILES; i++) {
    writeFileSync(path.join(stateDir, `perf-session-${i}${SEEN_FILE_SUFFIX}`), '', 'utf8');
  }

  /** The entry guard's two steps, in its order and with its counting callback. */
  function sessionStartWithSweep(): void {
    buildSessionStartOutput(cwd);
    let seenPruned = 0;
    pruneSnapshots(root, undefined, (name) => {
      if (name.endsWith(SEEN_FILE_SUFFIX)) seenPruned++;
    });
  }

  for (let i = 0; i < WARMUP; i++) sessionStartWithSweep();

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    sessionStartWithSweep();
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  // The fixture has to have survived, or every sample after the first measured
  // a directory that had already emptied itself.
  assert.equal(
    readdirSync(stateDir).filter((n) => n.endsWith(SEEN_FILE_SUFFIX)).length,
    STATE_FILES,
    'the sweep removed fixture entries that are inside the retention window',
  );

  const measured = summarize(samples);
  console.log(report('session-start+sweep', measured));
  assert.ok(measured.p95 < CEILING_MS, report('session-start+sweep', measured));
});

/**
 * The guard for the defect the three tests above used to carry, kept in this
 * file because it is this file's constants that it protects.
 *
 * A percentile only means what those assertions claim while it has samples
 * ABOVE it. Two edits silently take that away and nothing else in the suite
 * would notice: dropping `ITERATIONS` back towards 20, or restoring the
 * `floor(n * q)` index. Either turns all three ceilings back into a
 * max-of-n — still green, still called a p95, and once again reddening on
 * one GC pause until somebody "fixes" it by widening the ceiling.
 *
 * This costs no wall clock and fails on arithmetic, not on timing, so it is
 * the one test in this file that cannot be flaky.
 */
test('the ceilings in this file are percentiles, not maxima wearing a percentile name', () => {
  // A ramp is its own index, so `percentile` reads out the rank directly.
  const ramp = Array.from({ length: ITERATIONS }, (_, i) => i);
  const rank = percentile(ramp, PERCENTILE);

  assert.notEqual(
    rank,
    ITERATIONS - 1,
    `the p${PERCENTILE * 100} over ${ITERATIONS} samples is the maximum — the ` +
      'statistic and its name have come apart again. Raise ITERATIONS.',
  );
  const above = ITERATIONS - 1 - rank;
  assert.ok(
    above >= 5,
    `only ${above} of ${ITERATIONS} samples sit above the p${PERCENTILE * 100}; ` +
      'that is a maximum with rounding, not a percentile. Raise ITERATIONS to at least 100.',
  );

  // Nearest-rank, pinned against cases checked by hand rather than by the
  // same formula: the 95th percentile of 1..100 is 95, and the floor form
  // this file used to carry would answer 96.
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(hundred, 0.95), 95);
  assert.equal(percentile(hundred, 0.5), 50);
  assert.equal(percentile(hundred, 1), 100);
  assert.equal(percentile([7], 0.95), 7);
  const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(percentile(twenty, 0.95), 19, 'at n=20 even nearest-rank leaves one sample above');
});
