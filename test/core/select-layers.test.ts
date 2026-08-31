import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select, mergeLayers } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('project wins on id collision', () => {
  const merged = mergeLayers([
    item({ id: 'CONST-a', title: 'global', layer: 'global' }),
    item({ id: 'CONST-a', title: 'project', layer: 'project' }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'project');
});

test('non-colliding items from both layers survive', () => {
  const merged = mergeLayers([
    item({ id: 'CONST-g', layer: 'global' }),
    item({ id: 'CONST-p', layer: 'project' }),
  ]);
  assert.deepEqual(merged.map((i) => i.id).sort(), ['CONST-g', 'CONST-p']);
});

test('project items are preferred when the pinned budget is tight', () => {
  const big = 'x'.repeat(4000);
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select([
    item({ id: 'CONST-global', layer: 'global', always: true, continuity: false, summary: null, summaryOf: null, body: big }),
    item({ id: 'CONST-project', layer: 'project', always: true, continuity: false, summary: null, summaryOf: null, body: big }),
  ], { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-project']);
});

test('the index stays bounded — 5000 rationale items produce counts, not listings', () => {
  const many: Item[] = [];
  for (let i = 0; i < 5000; i++) {
    many.push(item({ id: `LESSON-${i}`, type: 'lesson', title: `Lesson ${i}` }));
  }
  const sel = select(many, { event: 'session-start' }, CONFIG);
  assert.deepEqual(sel.index.normative, []);
  assert.equal(sel.index.counts.lesson, 5000);
});

test('the index stays bounded — 5000 normative items are truncated, not listed in full', () => {
  const many: Item[] = [];
  for (let i = 0; i < 5000; i++) {
    many.push(item({ id: `CONST-${String(i).padStart(4, '0')}`, title: `Constraint ${i}` }));
  }
  const sel = select(many, { event: 'session-start' }, CONFIG);
  // `lesson` is rationale-tier and never reaches `index.normative`, so the
  // original brief test (kept above for its counts coverage) can't exercise
  // index-budget enforcement. `constraint` is normative-tier, so this is the
  // case that actually proves the index stays bounded rather than listing
  // all 5000 entries.
  assert.ok(sel.index.normative.length < 5000, 'normative listing must not grow unbounded');
  assert.equal(sel.index.normative.length + sel.index.truncated, 5000);
  assert.deepEqual(
    sel.spilled.filter((s) => s.tier === 'index').map((s) => s.id).length,
    sel.index.truncated,
  );
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
    item({ id: 'CONST-seen', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard', body: big }),
    item({ id: 'CONST-fresh', always: true, continuity: false, summary: null, summaryOf: null, severity: 'soft', body: big }),
  ], { event: 'session-start', seen: ['CONST-seen'] }, cfg);

  // CONST-seen sorts first on severity. If it were budgeted before being
  // filtered, it would eat the budget and CONST-fresh would spill.
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-fresh']);
  assert.deepEqual(sel.spilled, []);
});
