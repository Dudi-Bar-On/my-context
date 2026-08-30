/**
 * The statistic every perf ceiling in this suite is asserted at, in one place
 * so that the statistic and the name it is given cannot drift apart again.
 *
 * ── The defect this file exists to end ──────────────────────────────────
 *
 * Every perf file used to carry its own four-line `p95` helper indexing
 * `floor(n * 0.95)`. That expression is the LAST index of the sorted array
 * whenever `0.05 * n <= 1` — that is, for every `n <= 20` — and four files
 * ran `ITERATIONS = 20`. So each assertion those files called a "p95" was in
 * fact the MAXIMUM of twenty samples; `p95` and `max` were observed printing
 * the identical 5167.7ms.
 *
 * A maximum is the least stable statistic available and uniquely it gets
 * worse the harder you measure: E[max] rises with the sample count, so
 * honest extra sampling makes a max-based gate redder. That is the ratchet
 * that ends with somebody widening a ceiling until the gate can no longer
 * fail — which is the one outcome a perf gate must not reach
 * (`test/helpers/perf.ts` · `it certifies the absence of order-of-magnitude regressions` · ~42).
 *
 * `session-start-latency.perf.ts` fixed itself first and states the argument
 * at length in its own header
 * (`test/perf/session-start-latency.perf.ts` · `statistic and its name have come apart again` · ~483);
 * this file is that fix extracted so its three siblings share the code
 * rather than three more copies of the arithmetic. That file keeps its own
 * local copy, and the guard test beside this one pins the two forms agree.
 *
 * ── Why a percentile rather than a maximum ──────────────────────────────
 *
 * The deciding question is what these gates are FOR. Nothing in the product
 * promises that no individual hook call ever exceeds its budget; the budgets
 * are per-event costs, and one descheduled iteration inside an in-process
 * measurement loop is not a user-visible event at all. What the gates exist
 * to catch is a REGRESSION — a change that moves the whole distribution: an
 * accidental O(n) rescan per call, a per-call process spawn, a lock stall. A
 * regression detector wants a stable statistic, and a maximum is not one.
 *
 * So: nearest-rank percentile, and a sample count large enough that the
 * percentile has a real tail above it.
 *
 * What a green run does NOT certify, stated so nobody reads more into it: a
 * regression afflicting fewer than ~5% of calls will not move the p95. `max`
 * is therefore still computed and still printed, in the console line and in
 * every failure message — diagnostic, not the verdict. Read a red run by its
 * SHAPE: every statistic up together → the machine, re-run; p95 and max up
 * while the median holds → tail noise, re-run; the MEDIAN moved → the code,
 * investigate before any retry.
 */

/** The quantile every ceiling built on this helper is asserted at. */
export const PERCENTILE = 0.95;

/**
 * The sample count the ceilings need, not a tuning knob.
 *
 * At n=100 the p95 is the 95th of 100 sorted samples with FIVE samples above
 * it — the smallest count at which a 95th percentile is an order statistic
 * with a real tail over it instead of a synonym for the maximum. Below ~40 it
 * degenerates: at n=20 even a correctly indexed p95 has ONE sample above it,
 * which is a maximum with rounding.
 *
 * 100 rather than the 200 that `jit-latency`, `focus-latency` and
 * `audit-latency` use for their own local loops, because one iteration in the
 * files sharing this constant is a whole hook call (single-digit to tens of
 * ms) rather than a microbenchmark; resampling experiments recorded in
 * `session-start-latency.perf.ts` narrowed the run-to-run spread only from
 * 1.9× to 1.7× going from 100 to 200, which is what decided 100.
 *
 * `perf-stats.test.ts` fails if this drops back below the point where the p95
 * has a tail.
 */
export const PERF_SAMPLES = 100;

/**
 * Nearest-rank percentile of an ALREADY SORTED ascending array: the smallest
 * sample with at least a `q` fraction of the distribution at or below it.
 *
 * `ceil(n * q) - 1`, deliberately not `floor(n * q)`. The floor form is what
 * turned every ceiling in this suite into a max-of-20: it indexes the last
 * element whenever `(1 - q) * n <= 1`, and it is off by one high everywhere
 * else too (at n=200 it returns the 191st of 200, not the 190th).
 */
export function percentile(sorted: readonly number[], q: number): number {
  const index = Math.ceil(sorted.length * q) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

export interface Distribution {
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
 *
 * Note that on a 20-sample run `max` IS what the old helper reported as the
 * p95, so the two columns of any recorded baseline below are directly
 * comparable with the pre-2026-08-30 figures in each file's header.
 */
export function summarize(samples: readonly number[]): Distribution {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0],
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, PERCENTILE),
    max: sorted[sorted.length - 1],
  };
}

/** One line carrying the shape, used for both the console log and the failure. */
export function report(label: string, d: Distribution, ceilingMs: number): string {
  return (
    `${label} p95 ${d.p95.toFixed(1)}ms over ${d.n} samples ` +
    `(min ${d.min.toFixed(1)}, median ${d.median.toFixed(1)}, max ${d.max.toFixed(1)}ms) ` +
    `against a ${ceilingMs}ms ceiling`
  );
}

/**
 * The first and last quarter of a run, in ARRIVAL order, as one line.
 *
 * Raising a sample count from 20 to 100 is only free if the fixture is
 * stationary, and not every one of them is: `session-end-latency.perf.ts`
 * consumes a window per iteration, so its `state/` directory shrinks under
 * the loop and the early calls pay a bigger `readdirSync`. A slope like that
 * is invisible in any single statistic — it shows up only as a slightly fatter
 * upper tail, indistinguishable from noise.
 *
 * So every file that raised its count prints this beside the distribution. It
 * is DIAGNOSTIC and never asserted: a widening gap says the fixture is
 * drifting, which is a fact about the harness, and a flat one says the longer
 * loop measures the same thing the short one did.
 */
export function slope(label: string, samples: readonly number[]): string {
  const quarter = Math.max(1, Math.floor(samples.length / 4));
  const head = summarize(samples.slice(0, quarter));
  const tail = summarize(samples.slice(-quarter));
  return (
    `${label} fixture slope over ${samples.length} samples: ` +
    `first-${quarter} median ${head.median.toFixed(1)}ms, ` +
    `last-${quarter} median ${tail.median.toFixed(1)}ms`
  );
}
