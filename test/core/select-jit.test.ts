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

test('a scope match on a tool event injects in the jit tier', () => {
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-db']);
  assert.equal(sel.full[0].tier, 'jit');
});

test('a non-matching path injects nothing', () => {
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/api/handler.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('an item with no scope is inert — it never JIT-activates', () => {
  const sel = select(
    [item({ id: 'CONST-noscope', scope: [] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('a tool event never injects the pinned set', () => {
  const sel = select(
    [item({ id: 'CONST-pinned', always: true, scope: [] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('a tool event emits no index — that cost belongs to session start', () => {
  const sel = select(
    [item({ id: 'LESSON-a', type: 'lesson' }), item({ id: 'CONST-b', scope: ['src/**'] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.index, {
    normative: [], counts: {}, drafts: 0, retired: 0, truncated: 0, ineligible: {},
  });
});

test('a session start still emits the index and the pinned tier', () => {
  const sel = select(
    [item({ id: 'CONST-pinned', always: true }), item({ id: 'LESSON-a', type: 'lesson' })],
    { event: 'session-start' },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-pinned']);
  assert.equal(sel.index.counts.lesson, 1);
});

test('ledger-seen items are not re-injected by JIT', () => {
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/db/writer.ts', seen: ['CONST-db'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('a seen item does not consume JIT budget and spill a fresh one', () => {
  const big = 'x'.repeat(1600); // ~400 tokens each
  const items = [
    item({ id: 'CONST-seen', scope: ['src/db/**'], body: big }),
    item({ id: 'CONST-fresh', scope: ['src/db/**'], body: big }),
  ];
  const sel = select(items, { event: 'tool', path: 'src/db/writer.ts', seen: ['CONST-seen'] }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-fresh']);
  assert.deepEqual(sel.spilled, []);
});

test('over the JIT budget, hard severity wins and the rest are logged as spilled', () => {
  const big = 'x'.repeat(1600);
  const items = [
    item({ id: 'CONST-soft', scope: ['src/**'], severity: 'soft', body: big }),
    item({ id: 'CONST-hard', scope: ['src/**'], severity: 'hard', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { jit: 420 } });
  const sel = select(items, { event: 'tool', path: 'src/db/writer.ts' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-hard']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-soft']);
  assert.equal(sel.spilled[0].tier, 'jit');
});

test('rationale categories never JIT-activate however well they match', () => {
  const sel = select(
    [item({ id: 'LESSON-db', type: 'lesson', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('draft and superseded items never JIT-activate', () => {
  const items = [
    item({ id: 'CONST-draft', scope: ['src/**'], status: 'draft' }),
    item({ id: 'CONST-old', scope: ['src/**'], status: 'superseded' }),
  ];
  const sel = select(items, { event: 'tool', path: 'src/db/writer.ts' }, CONFIG);
  assert.deepEqual(sel.full, []);
});

test('a disabled category never JIT-activates', () => {
  const cfg = resolveConfig({ categories: { constraint: { enabled: false } } });
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    cfg,
  );
  assert.deepEqual(sel.full, []);
});

test('a backslash path is normalized before the glob is applied', () => {
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src\\db\\writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-db']);
});

test('a tool event with no path selects nothing', () => {
  const items = [item({ id: 'CONST-db', scope: ['src/db/**'] })];
  assert.deepEqual(select(items, { event: 'tool' }, CONFIG).full, []);
  assert.deepEqual(select(items, { event: 'tool', path: null }, CONFIG).full, []);
  assert.deepEqual(select(items, { event: 'tool', path: '' }, CONFIG).full, []);
});

test('project items shadow global items on the JIT path too', () => {
  const sel = select([
    item({ id: 'CONST-db', title: 'global', layer: 'global', scope: ['src/db/**'] }),
    item({ id: 'CONST-db', title: 'project', layer: 'project', scope: ['src/db/**'] }),
  ], { event: 'tool', path: 'src/db/writer.ts' }, CONFIG);
  assert.equal(sel.full.length, 1);
  assert.equal(sel.full[0].item.title, 'project');
});
