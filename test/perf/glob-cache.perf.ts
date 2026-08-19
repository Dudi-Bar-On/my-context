/**
 * What glob matching costs when the same patterns are asked about many paths.
 *
 * `matchesAnyGlob` is the shape underneath `matchesScope`, and `matchesScope`
 * is what answers "does this item govern this path" for every file the coverage
 * map draws. That is the access pattern this measures: **many subjects, few
 * patterns** — a repository's worth of paths against a corpus's worth of
 * authored scope globs.
 *
 * Before `globToRegExp` cached, every one of those questions compiled a fresh
 * `RegExp`, so the cost was O(files × patterns) compilations for an answer that
 * needs O(patterns) of them. On a monorepo-shaped input that is the difference
 * between a coverage screen that renders and one that stalls.
 *
 * Recorded baseline (2026-08-19, dev machine, 4,000 paths × 12 patterns, median
 * of 12 runs after 2 warm-ups):
 *
 *   compiling per call   28.0 ms
 *   cached               ~2.7 ms
 *
 * Roughly a **ten-fold** reduction on this shape. That is larger than the
 * 2.6–3× the v2.0 expert review recorded, and the difference is the shape, not
 * a disagreement: the gain scales with subjects-per-pattern, so a review
 * measuring fewer paths per pattern correctly saw less. Neither number
 * generalises, which is why the assertion below is a ceiling rather than a
 * ratio.
 *
 * **What is asserted, and why it is not the speed-up.** A ratio between two
 * wall-clock samples on a shared machine is scheduler noise as much as
 * behaviour, and a test asserting one fails on a busy CI runner rather than on
 * a regression. What IS asserted is the property that would actually have been
 * lost: that repeated matching is **not** recompiling — pinned as a ceiling far
 * enough below the uncached cost that only losing the cache can breach it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, matchesAnyGlob } from '../../src/core/paths.ts';

const PATTERNS = [
  'src/**', 'src/core/**', 'test/**/*.test.ts', 'docs/**/*.md', '**/*.ts',
  'src/cli/commands/*.ts', 'packages/*/src/**', '**/node_modules/**', 'a/b/c/**/*.js',
  'src/**/*.tsx', '*.json', 'scripts/*.ts',
];

const FILES: string[] = [];
for (let i = 0; i < 4000; i++) FILES.push(`packages/p${i % 40}/src/dir${i % 17}/file${i}.ts`);

function sweep(): number {
  let hits = 0;
  for (const f of FILES) if (matchesAnyGlob(f, PATTERNS)) hits++;
  return hits;
}

function medianMs(fn: () => unknown, runs: number): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = process.hrtime.bigint();
    fn();
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

test('the same pattern compiles once, however many subjects ask about it', () => {
  // The property, stated without a clock: two calls return the SAME object.
  // A `RegExp` here carries no `g`/`y` flag, so it holds no per-call state and
  // sharing one is safe — which is what makes it cacheable at all.
  const a = globToRegExp('src/**/*.ts');
  const b = globToRegExp('src/**/*.ts');
  assert.equal(a, b, 'globToRegExp recompiled a pattern it had already compiled');
  assert.equal(a.flags, '', 'a cached RegExp must be stateless — no g or y flag');
});

test('a cached RegExp still matches correctly after reuse', () => {
  const re = globToRegExp('src/**/*.ts');
  assert.equal(re.test('src/core/select.ts'), true);
  assert.equal(re.test('src/core/select.ts'), true, 'a second test() disagreed with the first');
  assert.equal(re.test('docs/x.md'), false);
  assert.equal(re.test('docs/x.md'), false);
});

test('sweeping a repository-shaped input stays well under the uncached cost', () => {
  sweep();
  sweep();
  const median = medianMs(sweep, 12);

  // The uncached baseline on this shape was 28.0 ms. 15 ms is comfortably
  // above the ~2.7 ms observed and comfortably below the cost of recompiling,
  // so this fails when the cache goes and not when the machine is busy.
  assert.ok(
    median < 15,
    `4,000 paths x 12 patterns took ${median.toFixed(1)} ms; uncached this shape cost 28.0 ms, ` +
    `cached ~2.7 ms. A figure near the uncached cost means globToRegExp is compiling per call.`,
  );
});

test('the sweep answers the same thing it did before caching', () => {
  // A cache that changed an answer would be a far worse defect than a slow one.
  assert.equal(sweep(), FILES.length, 'every generated path matches `packages/*/src/**`');
});
