import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDecay } from '../../src/core/decay.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, continuity: false, scope: ['src/**'], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

function report(over: Partial<Parameters<typeof computeDecay>[0]> = {}) {
  return computeDecay({
    items: [], config: CONFIG, usage: [], recentlyUsed: [], window: 20, sessionsRecorded: 50,
    ...over,
  });
}

test('an item never injected is cold with a zero count', () => {
  const r = report({ items: [item({ id: 'CONST-a' })] });
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a']);
  assert.equal(r.cold[0].useCount, 0);
  assert.equal(r.cold[0].lastUsed, null);
});

test('an item injected inside the window is warm, not cold', () => {
  const r = report({
    items: [item({ id: 'CONST-a' })],
    usage: [{ itemId: 'CONST-a', useCount: 7, lastUsed: '2026-08-14T10:00:00.000Z' }],
    recentlyUsed: ['CONST-a'],
  });
  assert.deepEqual(r.cold, []);
  assert.deepEqual(r.warm.map((w) => w.id), ['CONST-a']);
  assert.equal(r.warm[0].useCount, 7);
});

test('an item used long ago but not in the window is cold, and keeps its history', () => {
  const r = report({
    items: [item({ id: 'CONST-a' })],
    usage: [{ itemId: 'CONST-a', useCount: 3, lastUsed: '2026-01-01T00:00:00.000Z' }],
    recentlyUsed: [],
  });
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a']);
  assert.equal(r.cold[0].useCount, 3);
  assert.equal(r.cold[0].lastUsed, '2026-01-01T00:00:00.000Z');
});

/**
 * An unscoped item is unrestricted, not unreachable: it is injectable on
 * every path, so its usage is a real measurement and it belongs in the
 * cold/warm partition like anything else. It used to be pulled out of that
 * partition entirely, as a configuration gap that could never be injected.
 */
test('an unscoped normative item is measured as cold or warm, not excluded from decay', () => {
  const cold = report({ items: [item({ id: 'CONST-a', scope: [] })] });
  assert.deepEqual(cold.cold.map((c) => c.id), ['CONST-a']);
  assert.deepEqual(cold.warm, []);

  const warm = report({ items: [item({ id: 'CONST-a', scope: [] })], recentlyUsed: ['CONST-a'] });
  assert.deepEqual(warm.warm.map((w) => w.id), ['CONST-a']);
  assert.deepEqual(warm.cold, []);
});

/**
 * `unrestricted` is a breadth view over the same rows, not a fourth bucket:
 * the row appears BOTH there and in cold/warm. A consumer that sums all three
 * double-counts, and the report says so.
 */
test('an unscoped item appears in unrestricted AND in its cold/warm bucket', () => {
  const r = report({ items: [item({ id: 'CONST-a', scope: [] })] });
  assert.deepEqual(r.unrestricted.map((u) => u.id), ['CONST-a']);
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a']);
});

test('an item that declares a scope is not unrestricted', () => {
  const r = report({ items: [item({ id: 'CONST-a', scope: ['src/**'] })] });
  assert.deepEqual(r.unrestricted, []);
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a']);
});

/** Pinning is orthogonal: an unscoped pinned item is unrestricted too. */
test('an always:true item with no scope is unrestricted, and still measured', () => {
  const r = report({ items: [item({ id: 'CONST-a', scope: [], always: true })] });
  assert.deepEqual(r.unrestricted.map((u) => u.id), ['CONST-a']);
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a']);
});

test('ineligible items are excluded entirely', () => {
  const r = report({
    items: [
      item({ id: 'CONST-draft', status: 'draft' }),
      item({ id: 'CONST-old', status: 'superseded' }),
      item({ id: 'LESSON-a', type: 'lesson' }),
      item({ id: 'POL-a', type: 'policy' }),
    ],
  });
  assert.deepEqual([...r.cold, ...r.warm, ...r.unrestricted].map((x) => x.id), []);
});

test('a rationale category promoted to normative by config is included', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  const r = report({ config: cfg, items: [item({ id: 'EDGE-a', type: 'edge_case' })] });
  assert.deepEqual(r.cold.map((c) => c.id), ['EDGE-a']);
});

test('cold items sort coldest first: never-used before long-ago, then by id', () => {
  const r = report({
    items: [item({ id: 'CONST-b' }), item({ id: 'CONST-a' }), item({ id: 'CONST-c' })],
    usage: [{ itemId: 'CONST-c', useCount: 2, lastUsed: '2026-05-01T00:00:00.000Z' }],
  });
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a', 'CONST-b', 'CONST-c']);
});

test('the requested window and the recorded session count are reported separately', () => {
  // Nothing clamps, deliberately: "you asked for 20 sessions, the ledger holds
  // 4" is the honest report, and the command uses the gap to warn that "cold"
  // currently mostly means "new". Collapsing the two would hide that.
  const r = report({ window: 20, sessionsRecorded: 4, items: [item()] });
  assert.equal(r.window, 20);
  assert.equal(r.sessionsRecorded, 4);
});

test('scope is carried through so the report can suggest a fix', () => {
  const r = report({ items: [item({ scope: ['src/db/**'] })] });
  assert.deepEqual(r.cold[0].scope, ['src/db/**']);
});
