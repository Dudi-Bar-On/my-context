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
    item({ id: 'CONST-pinned', always: true, scope: [] }),
    item({ id: 'CONST-plain', always: false }),
  ];
  const sel = select(items, { event: 'session-start' }, CONFIG);
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
