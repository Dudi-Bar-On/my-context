import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import { occupancyStandDownLine, readOccupancy } from '../../src/core/context-occupancy.ts';

/**
 * Every temp root this file makes, removed once at the end.
 *
 * A `finally` per test is the house pattern, and it is the wrong one here:
 * `withStatusline` builds the root INSIDE the fixture, so a per-test `finally`
 * would need every test to hold the path it did not create. One `after` over a
 * list costs the same cleanup and cannot be forgotten by the next test added.
 */
const roots: string[] = [];
after(() => { for (const root of roots) removeTree(root); });

/**
 * The `context_window` block, in the shape Claude Code actually sends.
 *
 * Built field-by-field rather than copied from a captured payload because the
 * three token fields are what `classifyContext` sums, and a fixture whose
 * numbers are arbitrary cannot show that the sum is INPUT-ONLY. `output_tokens`
 * is present and deliberately non-zero: it is on the wire, it must NOT reach
 * the total, and a fixture that omitted it would let a regression that added it
 * pass unnoticed.
 */
function sampleOf(
  o: { window: number; input: number; cacheCreation: number; cacheRead: number },
): Record<string, unknown> {
  return {
    context_window: {
      context_window_size: o.window,
      current_usage: {
        input_tokens: o.input,
        cache_creation_input_tokens: o.cacheCreation,
        cache_read_input_tokens: o.cacheRead,
        output_tokens: 1_234,
      },
    },
  };
}

/** A sample sitting at roughly `percent` of a 200k window. */
function sample(percent: number): Record<string, unknown> {
  return sampleOf({ window: 200_000, input: (200_000 * percent) / 100, cacheCreation: 0, cacheRead: 0 });
}

/**
 * A workspace whose `.statusline/` holds one sample per named session.
 *
 * Written through `writeTee` — the real writer — rather than by hand. The file
 * name, the `{ receivedAt, payload }` envelope and the `.gitignore` beside it
 * are all `statusline-tee.ts`'s to decide, and a hand-built fixture would keep
 * passing after that module changed any of them while the product broke.
 */
function withStatusline(samples: Record<string, Record<string, unknown>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-occ-'));
  roots.push(root);
  for (const [sessionId, body] of Object.entries(samples)) {
    const result = writeTee(root, { session_id: sessionId, ...body });
    assert.deepEqual(result, { written: true }, `fixture for ${sessionId} was not written`);
  }
  return root;
}

test('no .statusline directory at all is no-bridge, and never a number', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-occ-'));
  roots.push(root);
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'no-bridge' });
});

test('a bridge with no sample for THIS session is no-sample', () => {
  const root = withStatusline({ 'other-session': sample(50) });
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'no-sample' });
});

test('a sample Claude Code no longer shapes the same way degrades to unknown-shape', () => {
  const root = withStatusline({ 'sess-1': { context_window: { current_usage: 'nope' } } });
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'unknown-shape' });
});

test('a sample with usage but no window size is unknown-shape, never a percentage', () => {
  const root = withStatusline({
    'sess-1': {
      context_window: {
        current_usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
    },
  });
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'unknown-shape' });
});

/**
 * The case the plan's sketch got wrong, and it is the one that matters most:
 * `current_usage: null` is what Claude Code sends between a compaction and the
 * next API call — precisely when a handover mechanism is being consulted. The
 * sketch mapped every non-`known` sample to `unknown-shape`, which would tell a
 * human that Claude Code's schema had moved at the exact moment nothing at all
 * was wrong.
 */
test('current_usage null just after a compaction is no-sample, not a schema break', () => {
  const root = withStatusline({
    'sess-1': { context_window: { context_window_size: 200_000, current_usage: null } },
  });
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'no-sample' });
});

test('a real sample gives the percentage Claude Code itself reports', () => {
  const root = withStatusline({
    'sess-1': sampleOf({ window: 200_000, input: 90_000, cacheRead: 106_000, cacheCreation: 0 }),
  });
  const occupancy = readOccupancy(root, 'sess-1');
  if (occupancy.state !== 'known') assert.fail(`expected a known occupancy, got ${occupancy.why}`);
  assert.equal(occupancy.usedTokens, 196_000);
  assert.equal(occupancy.windowSize, 200_000);
  assert.equal(Math.round(occupancy.percent), 98);
});

test('every unmeasurable reason produces a line that NAMES the reason', () => {
  for (const why of ['no-bridge', 'no-sample', 'unknown-shape'] as const) {
    assert.match(occupancyStandDownLine(why), /statusline|sample|shape/);
  }
});

/**
 * The three lines are three different things to tell a human, so they must not
 * be one line wearing three labels: a reader who is told "not installed" when
 * the bridge IS installed goes and installs it again.
 */
test('the three stand-down lines are distinct, prefixed once, and one line each', () => {
  const lines = (['no-bridge', 'no-sample', 'unknown-shape'] as const).map(occupancyStandDownLine);
  assert.equal(new Set(lines).size, 3);
  for (const line of lines) {
    assert.ok(line.startsWith('my_context: '), `missing the single prefix: ${line}`);
    assert.equal(line.match(/my_context:/gu)?.length, 1, `prefixed more than once: ${line}`);
    assert.ok(line.endsWith('\n'), `not newline-terminated: ${line}`);
    assert.equal(line.trimEnd().includes('\n'), false, `more than one line: ${line}`);
  }
  // Only the no-bridge line may tell someone to install the bridge.
  assert.match(lines[0]!, /mycontext statusline install/);
  assert.doesNotMatch(lines[1]!, /statusline install/);
  assert.doesNotMatch(lines[2]!, /statusline install/);
});
