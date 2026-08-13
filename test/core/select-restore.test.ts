import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select } from '../../src/core/select.ts';
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

test('a compact event injects the snapshot ids in full', () => {
  const sel = select([
    item({ id: 'CONST-restored' }),
    item({ id: 'CONST-untouched' }),
  ], { event: 'compact', restore: ['CONST-restored'] }, CONFIG);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-restored']);
  assert.equal(sel.full[0].tier, 'restored');
});

test('a compact event injects the pinned tier as well, without duplicating', () => {
  const sel = select([
    item({ id: 'CONST-pinned', always: true }),
    item({ id: 'CONST-restored' }),
  ], { event: 'compact', restore: ['CONST-pinned', 'CONST-restored'] }, CONFIG);

  assert.deepEqual(sel.full.map((e) => e.item.id).sort(), ['CONST-pinned', 'CONST-restored']);
  assert.equal(sel.full.filter((e) => e.item.id === 'CONST-pinned').length, 1);
  assert.equal(sel.full.find((e) => e.item.id === 'CONST-pinned')?.tier, 'pinned');
});

test('a compact event still emits the index header', () => {
  const sel = select(
    [item({ id: 'LESSON-a', type: 'lesson' })],
    { event: 'compact', restore: [] },
    CONFIG,
  );
  assert.equal(sel.index.counts.lesson, 1);
});

test('restore ids that no longer resolve are dropped silently', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-deleted-since', 'CONST-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
});

test('a superseded item is not restored — supersession is the pruning mechanism', () => {
  const sel = select(
    [item({ id: 'CONST-old', status: 'superseded' })],
    { event: 'compact', restore: ['CONST-old'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('a rationale item is never restored in full', () => {
  const sel = select(
    [item({ id: 'LESSON-a', type: 'lesson' })],
    { event: 'compact', restore: ['LESSON-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('over the restored budget, hard severity wins and the rest spill', () => {
  const big = 'x'.repeat(4000); // ~1000 tokens each
  const items = [
    item({ id: 'CONST-soft', severity: 'soft', body: big }),
    item({ id: 'CONST-hard', severity: 'hard', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { restored: 1200 } });
  const sel = select(items, {
    event: 'compact', restore: ['CONST-soft', 'CONST-hard'],
  }, cfg);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-hard']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-soft']);
  assert.equal(sel.spilled[0].tier, 'restored');
});

test('restore ids are ignored on a normal session start', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'session-start', restore: ['CONST-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('restore ids are ignored on a tool event', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'tool', path: 'src/db/writer.ts', restore: ['CONST-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('seen ids still suppress a restore', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-a'], seen: ['CONST-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('an item too big for pinned but admitted by restored is not falsely reported as spilled', () => {
  // ~1712 estimated tokens: over budgets.pinned (1500), under budgets.restored (2000).
  const big = 'x'.repeat(6800);
  const sel = select(
    [item({ id: 'CONST-big', always: true, severity: 'hard', body: big })],
    { event: 'compact', restore: ['CONST-big'] },
    CONFIG,
  );

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-big']);
  assert.equal(sel.full[0].tier, 'restored');
  assert.deepEqual(sel.spilled, []);
});

test('an item too big for both pinned and restored is still reported as spilled', () => {
  // ~2500 estimated tokens: over both budgets.pinned (1500) and budgets.restored (2000).
  const big = 'x'.repeat(10000);
  const sel = select(
    [item({ id: 'CONST-huge', always: true, severity: 'hard', body: big })],
    { event: 'compact', restore: ['CONST-huge'] },
    CONFIG,
  );

  assert.deepEqual(sel.full, []);
  const ids = sel.spilled.map((s) => s.id);
  assert.ok(ids.includes('CONST-huge'), `expected CONST-huge to be reported as spilled, got ${JSON.stringify(sel.spilled)}`);
});
