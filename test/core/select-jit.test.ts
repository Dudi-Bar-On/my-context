import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectableTypes, select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

/**
 * `injectableTypes` is the JIT hook's SQL pre-filter, and a pre-filter is only
 * safe while it is a SUPERSET of what `select` keeps — the `has_scope = 1`
 * predicate it replaced was not, which is how the old scope rule outlived
 * itself below the selector. Both halves are asserted here rather than only in
 * the perf suite: widening it (dropping `normative`) is invisible to behaviour
 * and shows up only as a hook that deserializes the whole corpus on every
 * Read, and narrowing it silently drops injections.
 */
test('injectableTypes is exactly the enabled normative categories', () => {
  const types = new Set(injectableTypes(CONFIG));
  assert.ok(types.has('constraint'), 'a normative, enabled category must be included');
  assert.ok(types.has('rule'));
  assert.equal(types.has('lesson'), false, 'rationale tier never JIT-injects');
  assert.equal(types.has('adr'), false);
  assert.equal(types.has('policy'), false, 'normative but disabled by default');

  const promoted = new Set(injectableTypes(
    resolveConfig({ categories: { edge_case: { tier: 'normative' } } })));
  assert.ok(promoted.has('edge_case'), 'config decides the tier, not the category table');

  const disabled = new Set(injectableTypes(
    resolveConfig({ categories: { constraint: { enabled: false } } })));
  assert.equal(disabled.has('constraint'), false);
});

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

/**
 * Scope is a restriction, not an enabler: an item that declares none is
 * unrestricted, so it JIT-activates on every path. This inverts the original
 * implementation, in which an empty scope matched nothing — a
 * misimplementation of the requirement, corrected here.
 *
 * Two unrelated paths, so this cannot pass by coincidence of one glob.
 */
test('an item with no scope JIT-activates on every path — scope restricts, it does not enable', () => {
  for (const path of ['src/db/writer.ts', 'docs/unrelated/notes.md']) {
    const sel = select([item({ id: 'CONST-noscope', scope: [] })], { event: 'tool', path }, CONFIG);
    assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-noscope'], `on ${path}`);
    assert.equal(sel.full[0].tier, 'jit', `on ${path}`);
  }
});

/**
 * `always` is orthogonal to scope, so an unscoped pinned item is BOTH pinned
 * and JIT-eligible. What stops it arriving twice is the ledger `seen` filter,
 * not an exemption in the JIT tier — the pinned injection at session start is
 * recorded, so the session's first tool event already treats it as seen.
 */
test('an unscoped pinned item is JIT-eligible, and the seen filter is what dedupes it', () => {
  const items = [item({ id: 'CONST-pinned', always: true, scope: [] })];
  const fresh = select(items, { event: 'tool', path: 'src/db/writer.ts' }, CONFIG);
  assert.deepEqual(fresh.full.map((e) => e.item.id), ['CONST-pinned']);

  const afterPinning = select(
    items, { event: 'tool', path: 'src/db/writer.ts', seen: ['CONST-pinned'] }, CONFIG,
  );
  assert.deepEqual(afterPinning.full, []);
});

test('a scoped item is still restricted to its globs — the inversion did not make scope inert', () => {
  const sel = select(
    [item({ id: 'CONST-db', always: true, scope: ['src/db/**'] })],
    { event: 'tool', path: 'docs/readme.md' },
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
  // Ids are chosen so the seen item sorts FIRST under byPriority's ordinal
  // id tiebreak. That makes sel.full itself the discriminator: the correct
  // implementation (seen filtered before budgeting) yields ['CONST-zfresh'],
  // while a regression that filtered `seen` out of both entries and spilled
  // only *after* budgeting would let the seen item consume the budget first
  // and spill the fresh one, yielding [] instead.
  const items = [
    item({ id: 'CONST-aseen', scope: ['src/db/**'], body: big }),
    item({ id: 'CONST-zfresh', scope: ['src/db/**'], body: big }),
  ];
  const sel = select(items, { event: 'tool', path: 'src/db/writer.ts', seen: ['CONST-aseen'] }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-zfresh']);
  assert.deepEqual(sel.spilled, []);
});

test('over the JIT budget, hard severity wins and the rest are logged as spilled', () => {
  const big = 'x'.repeat(1600);
  const items = [
    item({ id: 'CONST-soft', scope: ['src/**'], severity: 'soft', body: big }),
    item({ id: 'CONST-hard', scope: ['src/**'], severity: 'hard', body: big }),
  ];
  // 600, not the ~416-token cost of one item, so this stays "exactly one of
  // the two fits" even if renderItemBlock later grows a scope line or tier
  // marker — a fixture margin, not a tight-fit assertion on today's render.
  const cfg = resolveConfig({ budgets: { jit: 600 } });
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
