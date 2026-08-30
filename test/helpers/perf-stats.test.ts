import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERCENTILE, PERF_SAMPLES, percentile, report, slope, summarize } from './perf-stats.ts';

/**
 * The guard for the defect this helper exists to end.
 *
 * A percentile only means what the perf ceilings claim while it has samples
 * ABOVE it. Two edits silently take that away and nothing else in the suite
 * would notice: dropping `PERF_SAMPLES` back towards 20, or restoring the
 * `floor(n * q)` index. Either turns every ceiling built on this helper back
 * into a max-of-n — still green, still called a p95, and once again reddening
 * on one GC pause until somebody "fixes" it by widening the ceiling.
 *
 * This costs no wall clock and fails on arithmetic, not on timing, so it runs
 * in the ordinary suite rather than in `test:perf`, and it cannot be flaky.
 */
test('the shared perf statistic is a percentile, not a maximum wearing a percentile name', () => {
  // A ramp is its own index, so `percentile` reads out the rank directly.
  const ramp = Array.from({ length: PERF_SAMPLES }, (_, i) => i);
  const rank = percentile(ramp, PERCENTILE);

  assert.notEqual(
    rank,
    PERF_SAMPLES - 1,
    `the p${PERCENTILE * 100} over ${PERF_SAMPLES} samples is the maximum — the ` +
      'statistic and its name have come apart again. Raise PERF_SAMPLES.',
  );
  const above = PERF_SAMPLES - 1 - rank;
  assert.ok(
    above >= 5,
    `only ${above} of ${PERF_SAMPLES} samples sit above the p${PERCENTILE * 100}; ` +
      'that is a maximum with rounding, not a percentile. Raise PERF_SAMPLES to at least 100.',
  );
});

/**
 * Nearest-rank, pinned against cases checked by hand rather than by the same
 * formula. The floor form this suite used to carry answers 96 for the first
 * of these, and the LAST element for every array of twenty or fewer.
 */
test('percentile is nearest-rank: ceil(n * q) - 1, never floor(n * q)', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(hundred, 0.95), 95);
  assert.equal(percentile(hundred, 0.5), 50);
  assert.equal(percentile(hundred, 1), 100);
  assert.equal(percentile([7], 0.95), 7);

  const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(percentile(twenty, 0.95), 19, 'at n=20 even nearest-rank leaves one sample above');

  // The defect itself, restated as arithmetic: at every n <= 20 the floor form
  // and the maximum are the same number, which is why four files asserted one
  // while printing the name of the other.
  for (let n = 1; n <= 20; n++) {
    assert.equal(Math.floor(n * 0.95), n - 1, `floor(${n} * 0.95) is not the last index`);
  }
});

/**
 * `summarize` must not disturb the caller's array — the perf files print the
 * samples' arrival order in some cases and sort here, and an in-place sort
 * would silently reorder a fixture that is still being read.
 */
test('summarize reports the whole shape and leaves the input alone', () => {
  const samples = [5, 1, 4, 2, 3];
  const d = summarize(samples);

  assert.deepEqual(samples, [5, 1, 4, 2, 3], 'summarize sorted the caller\'s array in place');
  assert.equal(d.n, 5);
  assert.equal(d.min, 1);
  assert.equal(d.max, 5);
  assert.equal(d.median, 3);
  // At n=5 the p95 IS the maximum; the perf files never sample there, and the
  // guard above is what keeps them from drifting back to a count that does.
  assert.equal(d.p95, 5);
});

test('report names the statistic, the count and the ceiling it was judged against', () => {
  const line = report('some-hook', summarize([1, 2, 3, 4]), 50);
  assert.match(line, /some-hook p95 /);
  assert.match(line, /over 4 samples/);
  assert.match(line, /max 4\.0ms/);
  assert.match(line, /against a 50ms ceiling/);
});

/**
 * `slope` reads the run in ARRIVAL order, which is the whole point: sorting it
 * first would compare the smallest quarter with the largest and report a
 * drift on every stationary fixture.
 */
test('slope compares the first and last quarter of a run in arrival order', () => {
  // A descending ramp: the fixture emptying itself, which is what
  // session-end-latency.perf.ts does to its own `state/` directory.
  const falling = Array.from({ length: 100 }, (_, i) => 100 - i);
  const line = slope('some-hook', falling);
  assert.match(line, /first-25 median 88\.0ms/);
  assert.match(line, /last-25 median 13\.0ms/);

  // A flat fixture reports no drift, and a short run still reports something.
  assert.match(slope('flat', new Array(100).fill(4)), /first-25 median 4\.0ms, last-25 median 4\.0ms/);
  assert.match(slope('tiny', [1, 2]), /first-1 median 1\.0ms, last-1 median 2\.0ms/);
});
