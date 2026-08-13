import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select, isEligible, estimateTokens } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('only active items are eligible', () => {
  assert.equal(isEligible(item({ status: 'active' }), CONFIG), true);
  assert.equal(isEligible(item({ status: 'draft' }), CONFIG), false);
  assert.equal(isEligible(item({ status: 'superseded' }), CONFIG), false);
});

test('disabled categories are not eligible', () => {
  const cfg = resolveConfig({ categories: { constraint: { enabled: false } } });
  assert.equal(isEligible(item(), cfg), false);
});

test('rationale categories are never injected in full', () => {
  const sel = select([item({ id: 'LESSON-a', type: 'lesson', always: true })],
    { event: 'session-start' }, CONFIG);
  assert.deepEqual(sel.full, []);
  assert.equal(sel.index.counts.lesson, 1);
});

test('a project tier override makes a rationale category injectable', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  const sel = select([item({ id: 'EDGE-a', type: 'edge_case', always: true })],
    { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['EDGE-a']);
});

test('pinned tier takes always:true regardless of scope', () => {
  const items = [
    item({ id: 'CONST-pinned', always: true, scope: ['src/**'] }),
    item({ id: 'CONST-plain', always: false }),
  ];
  // ctx.path deliberately does NOT match the pinned item's scope. Scope
  // matching is a later-plan (JIT tier) concern; the pinned tier must not
  // consult it at all.
  const sel = select(items, { event: 'session-start', path: 'docs/x.md' }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-pinned']);
  assert.equal(sel.full[0].tier, 'pinned');
});

test('over budget, hard severity wins and the rest spill', () => {
  const big = 'x'.repeat(4000); // ~1000 tokens each
  const items = [
    item({ id: 'CONST-soft', always: true, severity: 'soft', body: big }),
    item({ id: 'CONST-hard', always: true, severity: 'hard', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-hard']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-soft']);
  assert.match(sel.spilled[0].reason, /budget/i);
});

test('spilled items still appear in the index', () => {
  const big = 'x'.repeat(4000);
  const items = [
    item({ id: 'CONST-a', always: true, severity: 'hard', body: big }),
    item({ id: 'CONST-b', always: true, severity: 'soft', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-a', 'CONST-b']);
});

test('estimateTokens is roughly chars over four', () => {
  assert.equal(estimateTokens('x'.repeat(400)), 100);
});

test('already-seen items are not re-injected', () => {
  const sel = select([item({ id: 'CONST-a', always: true })],
    { event: 'session-start', seen: ['CONST-a'] }, CONFIG);
  assert.deepEqual(sel.full, []);
});

test('a seen item does not consume budget and spill a fresh one', () => {
  const big = 'x'.repeat(4000); // ~1000 tokens each
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select([
    item({ id: 'CONST-seen', always: true, severity: 'hard', body: big }),
    item({ id: 'CONST-fresh', always: true, severity: 'soft', body: big }),
  ], { event: 'session-start', seen: ['CONST-seen'] }, cfg);

  // CONST-seen sorts first on severity. If it were budgeted before being
  // filtered, it would eat the budget and CONST-fresh would spill.
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-fresh']);
  assert.deepEqual(sel.spilled, []);
});

test('fitToBudget is first-fit, not a strict priority prefix', () => {
  // B and A are both hard severity; B is 'project' layer (sorts first), A is
  // 'global' (sorts second). C is soft, so it sorts last regardless. Body
  // lengths are tuned so cost(B)=400, cost(A)=900, cost(C)=700 tokens exactly,
  // for id 'B'/'A'/'C' with the default type/title (26 chars of overhead).
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const items = [
    item({ id: 'B', always: true, severity: 'hard', layer: 'project', body: 'x'.repeat(1574) }),
    item({ id: 'A', always: true, severity: 'hard', layer: 'global', body: 'x'.repeat(3574) }),
    item({ id: 'C', always: true, severity: 'soft', body: 'x'.repeat(2774) }),
  ];
  const sel = select(items, { event: 'session-start' }, cfg);
  // B admits (used 400/1200). A would push used to 1300 > 1200, so it spills.
  // C, smaller and LOWER priority than A, still fits in the remaining budget
  // (400 + 700 = 1100 <= 1200) — a hard constraint dropped while a soft item
  // is injected. This is deliberate first-fit behaviour, not a bug.
  assert.deepEqual(sel.full.map((e) => e.item.id), ['B', 'C']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['A']);
});

test('retired statuses are aggregated and excluded from per-category counts', () => {
  const items = [
    item({ id: 'LESSON-a', type: 'lesson', status: 'validated' }),
    item({ id: 'LESSON-b', type: 'lesson', status: 'active' }),
    item({ id: 'CONST-a', type: 'constraint', status: 'superseded' }),
    item({ id: 'CONST-b', type: 'constraint', status: 'deprecated' }),
  ];
  const sel = select(items, { event: 'session-start' }, CONFIG);
  // superseded, deprecated, and validated are all retired: 3 total.
  assert.equal(sel.index.retired, 3);
  // The retired lesson does not inflate the (rationale) per-category count.
  assert.equal(sel.index.counts.lesson, 1);
  // Retired constraints (normative) do not appear in the normative listing.
  assert.deepEqual(sel.index.normative, []);
});

test('drafts and retired are computed from the raw item set, including disabled categories', () => {
  const cfg = resolveConfig({ categories: { edge_case: { enabled: false } } });
  const items = [
    item({ id: 'CONST-a', type: 'constraint', status: 'draft' }),
    item({ id: 'EDGE-a', type: 'edge_case', status: 'draft' }),
    item({ id: 'CONST-b', type: 'constraint', status: 'active' }),
    item({ id: 'EDGE-b', type: 'edge_case', status: 'superseded' }),
  ];
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.equal(sel.index.drafts, 2);
  assert.equal(sel.index.retired, 1);
});

test('itemCost counts observations, not just body', () => {
  const bigObservation = 'x'.repeat(4000); // ~1000 tokens
  const cfg = resolveConfig({ budgets: { pinned: 1000 } });

  const withObservations = item({
    id: 'CONST-a', always: true, severity: 'hard',
    observations: [{ category: 'note', text: bigObservation, tags: [], context: null }],
  });
  const selWith = select([withObservations], { event: 'session-start' }, cfg);
  assert.deepEqual(selWith.full, []);
  assert.deepEqual(selWith.spilled.map((s) => s.id), ['CONST-a']);

  const withoutObservations = item({ id: 'CONST-a', always: true, severity: 'hard' });
  const selWithout = select([withoutObservations], { event: 'session-start' }, cfg);
  assert.deepEqual(selWithout.full.map((e) => e.item.id), ['CONST-a']);
});

test('index normative listing is bounded by config.budgets.index', () => {
  const cfg = resolveConfig({ budgets: { index: 20 } });
  const items = [
    item({ id: 'CONST-a' }),
    item({ id: 'CONST-b' }),
    item({ id: 'CONST-c' }),
  ];
  const sel = select(items, { event: 'session-start' }, cfg);
  // Each "id type title" line costs 9 estimated tokens; only the first two
  // fit in a budget of 20 (9 + 9 = 18 <= 20; a third would be 27 > 20).
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-a', 'CONST-b']);
  assert.equal(sel.index.truncated, 1);
  assert.deepEqual(
    sel.spilled.filter((s) => s.tier === 'index').map((s) => s.id),
    ['CONST-c'],
  );
});
