import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perfCeiling, WINDOWS_CI_MULTIPLIER } from './perf.ts';

/**
 * The scaling rule for perf ceilings, pinned. The product budgets stay in
 * force everywhere a measurement can certify them; only the GitHub Windows
 * runner — whose measured noise exceeds the budgets themselves (see
 * perf.ts's header) — gets the order-of-magnitude ceiling instead.
 */
test('the product budget is untouched on a dev machine, either platform', () => {
  assert.equal(perfCeiling(50, {}, 'win32'), 50);
  assert.equal(perfCeiling(50, {}, 'linux'), 50);
  // CI unset is not enough to widen; it must BE GitHub Actions.
  assert.equal(perfCeiling(50, { GITHUB_ACTIONS: 'false' }, 'win32'), 50);
});

test('Ubuntu CI keeps certifying the real budget — a degraded VM is re-run, not absorbed', () => {
  assert.equal(perfCeiling(50, { GITHUB_ACTIONS: 'true' }, 'linux'), 50);
  assert.equal(perfCeiling(500, { GITHUB_ACTIONS: 'true' }, 'darwin'), 500);
});

test('Windows CI gets the order-of-magnitude ceiling, not the product budget', () => {
  assert.equal(perfCeiling(50, { GITHUB_ACTIONS: 'true' }, 'win32'), 500);
  assert.equal(perfCeiling(500, { GITHUB_ACTIONS: 'true' }, 'win32'), 5000);
});

test('the widened ceiling clears the worst runner noise ever observed and still catches the regression class', () => {
  const ceiling = perfCeiling(50, { GITHUB_ACTIONS: 'true' }, 'win32');
  // 371.5ms is the worst JIT hit-path p95 the runner produced on unchanged
  // code (run 31797092961); the ceiling must sit above the noise...
  assert.ok(ceiling > 371.5, `ceiling ${ceiling}ms is inside the observed noise band`);
  // ...and far below the class it exists to catch (the E4 stall was 16.9s;
  // one process spawn per call is ~1s of p95 on this runner).
  assert.ok(ceiling <= 1000, `ceiling ${ceiling}ms no longer catches a per-call process spawn`);
  assert.equal(WINDOWS_CI_MULTIPLIER, 10);
});
