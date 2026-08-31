import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import {
  CONTEXT_SAMPLE_FRESH_MS, occupancyStandDownLine, readOccupancy,
} from '../../src/core/context-occupancy.ts';

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

/* -------------------------------------------------------------------------- *
 * THE FRESHNESS GATE — `plan:walk seq:123`.
 *
 * The reported case, verbatim: the strip showed 60.1% while the real occupancy
 * was 100%, because the sample it drew had been received 29 hours earlier and
 * nothing checked. The same fossil is why the `Stop` handover ask never fired —
 * 60.1% is below any threshold, so the mechanism compared a dead number and
 * stayed silent, which looks exactly like a mechanism that works.
 *
 * `writeTee`'s third parameter is the real writer's own `receivedAt`, so these
 * fixtures age a sample the way the product does rather than by hand-building
 * an envelope this module would then be tested against instead of the product.
 * -------------------------------------------------------------------------- */

/** A workspace whose one sample was tee'd `ageMs` ago. */
function withAgedSample(ageMs: number): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-occ-'));
  roots.push(root);
  const at = new Date(Date.now() - ageMs).toISOString();
  const result = writeTee(root, { session_id: 'sess-1', ...sample(60.1) }, at);
  assert.deepEqual(result, { written: true }, 'the fixture was not written');
  return root;
}

test('a 29-hour-old sample is stale, and is NEVER handed back as a percentage', () => {
  const occupancy = readOccupancy(withAgedSample(29 * 60 * 60_000), 'sess-1');
  assert.deepEqual(occupancy, { state: 'unmeasurable', why: 'stale' });
});

test('a sample inside the freshness window is still a reading, and carries its stamp', () => {
  const occupancy = readOccupancy(withAgedSample(CONTEXT_SAMPLE_FRESH_MS - 60_000), 'sess-1');
  if (occupancy.state !== 'known') assert.fail(`expected a known occupancy, got ${occupancy.why}`);
  assert.equal(Math.round(occupancy.percent), 60);
  assert.match(occupancy.receivedAt, /^\d{4}-\d{2}-\d{2}T/,
    'the reading carries the moment it was taken, so a caller can tell a NEW sample from a redraw');
});

/**
 * The gate is a boundary, and a boundary nobody can land on has an off-by-one
 * in it. `>` on the age, so a sample exactly at the window is still fresh.
 */
test('the boundary is exact: at the window fresh, one millisecond past it stale', () => {
  // A hair inside, to leave room for the milliseconds this test itself spends.
  assert.equal(readOccupancy(withAgedSample(CONTEXT_SAMPLE_FRESH_MS - 2_000), 'sess-1').state, 'known');
  assert.equal(readOccupancy(withAgedSample(CONTEXT_SAMPLE_FRESH_MS + 2_000), 'sess-1').state,
    'unmeasurable');
});

/**
 * **A sample that cannot be dated cannot be shown to be current.**
 *
 * `receivedAt` is this product's own envelope field, not Claude Code's, so an
 * unparseable one means our writer produced something our reader cannot read.
 * Falling through to `known` would restore the reported defect for the one case
 * nobody would think to test.
 */
test('an undatable receivedAt is stale, not a reading', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-occ-'));
  roots.push(root);
  assert.deepEqual(writeTee(root, { session_id: 'sess-1', ...sample(60.1) }, 'not-a-date'),
    { written: true });
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'stale' });
});

/**
 * The three older reasons keep their exact meanings. A fossil that is ALSO
 * unreadable is `unknown-shape`, because a schema break is the actionable half
 * of it and "upgrade my_context" is a different errand from "the session is
 * idle".
 */
test('the freshness gate does not swallow the three reasons that came before it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-occ-'));
  roots.push(root);
  const long_ago = new Date(Date.now() - 29 * 60 * 60_000).toISOString();
  assert.deepEqual(writeTee(root, { session_id: 'sess-1', context_window: 'not an object' }, long_ago),
    { written: true });
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'unknown-shape' });
  assert.deepEqual(readOccupancy(root, 'sess-never-sampled'), { state: 'unmeasurable', why: 'no-sample' });
});

test('every unmeasurable reason produces a line that NAMES the reason', () => {
  for (const why of ['no-bridge', 'no-sample', 'unknown-shape', 'stale'] as const) {
    assert.match(occupancyStandDownLine(why), /statusline|sample|shape/);
  }
});

/**
 * The four lines are four different things to tell a human, so they must not
 * be one line wearing four labels: a reader who is told "not installed" when
 * the bridge IS installed goes and installs it again.
 */
test('the four stand-down lines are distinct, prefixed once, and one line each', () => {
  const lines = (['no-bridge', 'no-sample', 'unknown-shape', 'stale'] as const)
    .map(occupancyStandDownLine);
  assert.equal(new Set(lines).size, 4);
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
  assert.doesNotMatch(lines[3]!, /statusline install/);
});
