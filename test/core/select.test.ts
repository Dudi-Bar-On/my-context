import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select, isEligible, estimateTokens, itemCost } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { renderItemBlock } from '../../src/core/render-item.ts';
import { renderSelection } from '../../src/core/render.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
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

/**
 * `known_issue` reaches a session, and the two mechanisms that make it do so.
 *
 * It shipped on the rationale tier, which matched its grammar — "the sandbox
 * declines test cards at random" is a present fact, not a directive — and
 * defeated the category outright. A rationale item is never injected in full,
 * AND `buildIndex` reduces the whole tier to counts, so the only trace a
 * `known_issue` left in a session was the digit in `1 known_issue`. The
 * category's entire job is to stop an agent spending an afternoon on something
 * already known to be broken, and it cannot do that from a place the agent
 * never reads.
 *
 * Both halves are asserted, because either one alone would still be an item
 * nobody sees: it is admitted to a full-text tier, and — when it is not
 * admitted in full — it is NAMED in the index rather than counted. The
 * negative half pins that it has left the counts, so a silent revert to
 * `rationale` fails here rather than passing on the positive assertion of
 * some other category.
 */
test('a known_issue is injected in full and named in the index, not reduced to a count', () => {
  const known = item({ id: 'KNOWN-a', type: 'known_issue', title: 'Sandbox declines test cards' });

  const pinned = select([{ ...known, always: true }], { event: 'session-start' }, CONFIG);
  assert.deepEqual(pinned.full.map((e) => e.item.id), ['KNOWN-a']);

  const indexed = select([known], { event: 'session-start' }, CONFIG);
  assert.deepEqual(indexed.index.normative.map((n) => n.id), ['KNOWN-a']);
  assert.equal(indexed.index.counts.known_issue, undefined,
    'a known_issue counted rather than named is the state this category was moved out of');

  const jit = select([{ ...known, scope: ['src/**'] }], { event: 'tool', path: 'src/a.ts' }, CONFIG);
  assert.deepEqual(jit.full.map((e) => e.item.id), ['KNOWN-a']);
});

test('a project tier override makes a rationale category injectable', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  const sel = select([item({ id: 'EDGE-a', type: 'edge_case', always: true })],
    { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['EDGE-a']);
});

test('pinned tier takes always:true regardless of scope', () => {
  const items = [
    item({ id: 'CONST-pinned', always: true, continuity: false, summary: null, summaryOf: null, scope: ['src/**'] }),
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
    item({ id: 'CONST-soft', always: true, continuity: false, summary: null, summaryOf: null, severity: 'soft', body: big }),
    item({ id: 'CONST-hard', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-hard']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-soft']);
  assert.match(sel.spilled[0].reason, /budget/i);
});

test('an item that spilled from full still appears in the index; an item admitted in full does not', () => {
  const big = 'x'.repeat(4000);
  const items = [
    item({ id: 'CONST-a', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard', body: big }),
    item({ id: 'CONST-b', always: true, continuity: false, summary: null, summaryOf: null, severity: 'soft', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select(items, { event: 'session-start' }, cfg);
  // CONST-a wins the pinned budget (hard severity) and is present in full —
  // it needs no index line, since Claude already has the complete item.
  // CONST-b spills from full and is genuinely unseen, so it still gets one.
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-b']);
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
    item({ id: 'CONST-seen', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard', body: big }),
    item({ id: 'CONST-fresh', always: true, continuity: false, summary: null, summaryOf: null, severity: 'soft', body: big }),
  ], { event: 'session-start', seen: ['CONST-seen'] }, cfg);

  // CONST-seen sorts first on severity. If it were budgeted before being
  // filtered, it would eat the budget and CONST-fresh would spill.
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-fresh']);
  assert.deepEqual(sel.spilled, []);
});

// --- TASK-seen-is-treated-as-delivered-current-and-whole-and-an-item -------
//
// A bare id in `seen` (above) keeps its pre-hardening, unverified meaning —
// every existing test above this line still passes unchanged. A `SeenEntry`
// is the verified form: `select` excuses an id from re-offering only when the
// entry says the delivery was WHOLE (a full-text tier, never a title-only
// index line) and CURRENT (its checksum still matches the item as `select`
// was handed it). Presence — whether the item is still in the live context
// window — is deliberately not modelled here: nothing observes an eviction,
// so this project does not pretend to verify what it cannot.

test('a title-only (non-whole) delivery does not excuse re-offering the item', () => {
  // Same checksum as the item itself (item()'s default is 'x') — wholeness
  // alone must be the reason this is re-offered, not a checksum mismatch.
  const sel = select([item({ id: 'CONST-a', always: true, checksum: 'x' })], {
    event: 'session-start',
    seen: [{ id: 'CONST-a', checksum: 'x', whole: false }],
  }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
});

test('a superseded (stale-checksum) delivery does not excuse re-offering the item', () => {
  // whole: true — the delivery WAS a full-text one — but the item has since
  // been edited: its current checksum ('y') no longer matches what was
  // delivered ('x'). Currency alone must be the reason this is re-offered.
  const sel = select([item({ id: 'CONST-a', always: true, checksum: 'y' })], {
    event: 'session-start',
    seen: [{ id: 'CONST-a', checksum: 'x', whole: true }],
  }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
});

test('a current, whole delivery still excuses re-offering the item', () => {
  const sel = select([item({ id: 'CONST-a', always: true, checksum: 'x' })], {
    event: 'session-start',
    seen: [{ id: 'CONST-a', checksum: 'x', whole: true }],
  }, CONFIG);
  assert.deepEqual(sel.full, []);
});

test('a seen SeenEntry does not consume budget and spill a fresh one, exactly as a bare id does', () => {
  const big = 'x'.repeat(4000);
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select([
    item({
      id: 'CONST-seen', always: true, continuity: false, summary: null, summaryOf: null,
      severity: 'hard', body: big, checksum: 'x',
    }),
    item({
      id: 'CONST-fresh', always: true, continuity: false, summary: null, summaryOf: null,
      severity: 'soft', body: big,
    }),
  ], {
    event: 'session-start',
    seen: [{ id: 'CONST-seen', checksum: 'x', whole: true }],
  }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-fresh']);
  assert.deepEqual(sel.spilled, []);
});

test('fitToBudget is first-fit, not a strict priority prefix', () => {
  // B and A are both hard severity; B is 'project' layer (sorts first), A is
  // 'global' (sorts second). C is soft, so it sorts last regardless. Body
  // lengths are tuned so cost(B)=300, cost(A)=1000, cost(C)=800 tokens
  // exactly, via itemCost = estimateTokens(renderItemBlock(item)) + 1 (the
  // block-separator cost) — 35 bytes of fixed render scaffolding for id
  // 'B'/'A'/'C' with the default type/title.
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const items = [
    item({ id: 'B', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard', layer: 'project', body: 'x'.repeat(1161) }),
    item({ id: 'A', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard', layer: 'global', body: 'x'.repeat(3961) }),
    item({ id: 'C', always: true, continuity: false, summary: null, summaryOf: null, severity: 'soft', body: 'x'.repeat(3161) }),
  ];
  const sel = select(items, { event: 'session-start' }, cfg);
  // B admits (used 300/1200). A would push used to 1300 > 1200, so it spills.
  // C, smaller and LOWER priority than A, still fits in the remaining budget
  // (300 + 800 = 1100 <= 1200) — a hard constraint dropped while a soft item
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
    id: 'CONST-a', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard',
    observations: [{ category: 'note', text: bigObservation, tags: [], context: null }],
  });
  const selWith = select([withObservations], { event: 'session-start' }, cfg);
  assert.deepEqual(selWith.full, []);
  assert.deepEqual(selWith.spilled.map((s) => s.id), ['CONST-a']);

  const withoutObservations = item({ id: 'CONST-a', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard' });
  const selWithout = select([withoutObservations], { event: 'session-start' }, cfg);
  assert.deepEqual(selWithout.full.map((e) => e.item.id), ['CONST-a']);
});

test('an active item of a disabled category is counted as ineligible, never dropped without a trace', () => {
  const cfg = resolveConfig({ categories: { standard: { enabled: false } } });
  const items = [item({ id: 'STD-a', type: 'standard', status: 'active' })];
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.equal(sel.index.ineligible.standard, 1);
});

test('an active item whose type is not in config at all is counted as ineligible', () => {
  const items = [item({ id: 'SLA-a', type: 'sla', status: 'active' })];
  const sel = select(items, { event: 'session-start' }, CONFIG);
  assert.equal(sel.index.ineligible.sla, 1);
});

test('a non-active item of a disabled category is not double-counted as ineligible', () => {
  const cfg = resolveConfig({ categories: { standard: { enabled: false } } });
  const items = [item({ id: 'STD-a', type: 'standard', status: 'draft' })];
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.equal(sel.index.ineligible.standard ?? 0, 0);
  assert.equal(sel.index.drafts, 1);
});

test('itemCost now accounts for scope (previously omitted): a huge scope list can push an item over budget', () => {
  const cfg = resolveConfig({ budgets: { pinned: 200 } });
  const hugeScope = Array.from({ length: 60 }, (_, i) => `src/module-${i}/**`);
  const sel = select(
    [item({ id: 'CONST-a', always: true, continuity: false, summary: null, summaryOf: null, body: 'short', scope: hugeScope })],
    { event: 'session-start' }, cfg,
  );
  assert.deepEqual(sel.full, []);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-a']);
});

test('itemCost matches the actual rendered cost of an item, including scope and observation tags/context', () => {
  const withEverything = item({
    id: 'CONST-a', always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard',
    scope: ['src/**', 'lib/**'],
    observations: [{ category: 'limit', text: 'Never exceed 20', tags: ['db', 'perf'], context: 'under load' }],
  });
  const cfg = resolveConfig({ budgets: { pinned: 10_000 } });
  const sel = select([withEverything], { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);

  // The cross-module invariant: whatever the selector believed an item cost,
  // the actual rendered text for that item must never exceed the pinned
  // budget it was admitted under — closing the gap where itemCost's formula
  // could silently drift from what render.ts actually emits (e.g. deleting
  // its relations/scope handling would previously stay green).
  const renderedCost = estimateTokens(renderItemBlock(withEverything));
  assert.ok(renderedCost <= cfg.budgets.pinned);
});

test('cross-module invariant: renderSelection never exceeds the enforced budgets by more than fixed scaffolding', () => {
  const cfg = resolveConfig({ budgets: { pinned: 1500, index: 150 } });
  const items: Item[] = [];
  for (let i = 0; i < 5; i++) {
    items.push(item({
      id: `CONST-${i}`, always: true, continuity: false, summary: null, summaryOf: null, severity: 'hard',
      body: 'x'.repeat(300),
      scope: ['src/**'], tags: ['db'],
      observations: [{ category: 'limit', text: 'x'.repeat(100), tags: ['db'], context: 'ctx' }],
    }));
  }
  for (let i = 0; i < 30; i++) {
    items.push(item({ id: `CONST-idx-${i}`, always: false, continuity: false, summary: null, summaryOf: null, title: `Constraint ${i}` }));
  }
  const sel = select(items, { event: 'session-start' }, cfg);
  const rendered = renderSelection(sel);
  // Generous fixed allowance for headers, separators and the spill/index
  // disclosure copy, none of which are themselves budgeted.
  const scaffolding = 300;
  assert.ok(
    estimateTokens(rendered) <= cfg.budgets.pinned + cfg.budgets.index + scaffolding,
    `rendered ${estimateTokens(rendered)} tokens exceeds pinned+index+scaffolding ` +
    `(${cfg.budgets.pinned + cfg.budgets.index + scaffolding})`,
  );
});

test('index normative listing is bounded by config.budgets.index', () => {
  const cfg = resolveConfig({ budgets: { index: 20 } });
  const items = [
    item({ id: 'CONST-a' }),
    item({ id: 'CONST-b' }),
    item({ id: 'CONST-c' }),
  ];
  const sel = select(items, { event: 'session-start' }, cfg);
  // Each rendered index line ("- CONST-a · constraint · A constraint") costs
  // 10 estimated tokens; only the first two fit in a budget of 20
  // (10 + 10 = 20 <= 20; a third would be 30 > 20).
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-a', 'CONST-b']);
  assert.equal(sel.index.truncated, 1);
  assert.deepEqual(
    sel.spilled.filter((s) => s.tier === 'index').map((s) => s.id),
    ['CONST-c'],
  );
});

test('an item admitted in full is excluded from the index normative listing', () => {
  const sel = select(
    [item({ id: 'CONST-pinned', always: true })],
    { event: 'session-start' },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-pinned']);
  // Already injected in full — an index line for it would be pure
  // redundancy, so it must not appear, and must not count as truncated
  // either (it was deliberately omitted, not cut for budget).
  assert.deepEqual(sel.index.normative, []);
  assert.equal(sel.index.truncated, 0);
});

test('removing the redundant line frees index budget for an item previously behind "+N more"', () => {
  const cfg = resolveConfig({ budgets: { index: 20, pinned: 1500 } });
  const items = [
    item({ id: 'CONST-a', always: true }), // admitted in full; no longer competes for index budget
    item({ id: 'CONST-b' }),
    item({ id: 'CONST-c' }),
  ];
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
  // Previously (redundancy included), CONST-a + CONST-b filled the 20-token
  // budget and CONST-c was truncated. With CONST-a excluded as redundant,
  // CONST-b and CONST-c both now fit (10 + 10 = 20 <= 20).
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-b', 'CONST-c']);
  assert.equal(sel.index.truncated, 0);
});

test('truncated still counts genuinely unlisted items after redundant lines are removed', () => {
  const cfg = resolveConfig({ budgets: { index: 20, pinned: 1500 } });
  const items = [
    item({ id: 'CONST-a', always: true }), // admitted in full; excluded from index candidates
    item({ id: 'CONST-b' }),
    item({ id: 'CONST-c' }),
    item({ id: 'CONST-d' }),
  ];
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
  // Even with CONST-a removed from the candidate pool, three 10-token lines
  // (b, c, d) don't all fit a 20-token budget — one is genuinely truncated.
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-b', 'CONST-c']);
  assert.equal(sel.index.truncated, 1);
  assert.deepEqual(
    sel.spilled.filter((s) => s.tier === 'index').map((s) => s.id),
    ['CONST-d'],
  );
});

test('rationale per-category counts are unaffected by items admitted in full', () => {
  const sel = select([
    item({ id: 'CONST-pinned', always: true }),
    item({ id: 'LESSON-a', type: 'lesson' }),
    item({ id: 'LESSON-b', type: 'lesson' }),
  ], { event: 'session-start' }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-pinned']);
  assert.equal(sel.index.counts.lesson, 2);
});

// --- the pinned tier's spill disclosure ------------------------------------

/**
 * **`always: true` MEANS ALWAYS, so a pinned tier that delivers part of itself
 * has to say which part it did not.**
 *
 * Measured on this repository's own corpus (REQ-a-pinned-item-is-delivered-or-
 * the-user-is-told-it-was-not): 23 pinned items against a 16,000 budget, 16
 * delivered, seven silently absent, and the injection record carried no account
 * of them at all. Among the seven was the instruction telling the assistant to
 * use my_context for everything it needs to remember — the corpus spilled the
 * rules that would have said it was not following the rules, and reported
 * success.
 *
 * `Selection.spilled` already named them, per item, in a list that also carries
 * `jit`, `restored` and `index` — three tiers whose spilling is BY DESIGN. What
 * no reader could get from it is the pair of numbers that answers "by how
 * much": the tier's whole cost, and the budget it was measured against. Those
 * are produced here, where the candidates and their costs are already in hand,
 * rather than re-derived by each surface that wants to say it.
 */
test('a partial pinned delivery names the ids it dropped, with the tier cost and the budget', () => {
  const items = [
    item({ id: 'CONST-a', always: true }),
    item({ id: 'CONST-b', always: true }),
    item({ id: 'CONST-c', always: true }),
  ];
  const whole = items.reduce((sum, i) => sum + itemCost(i), 0);
  // A budget that admits some and not all: the PARTIAL case, which is the one
  // that lies. See the all-spilled case below for why this is the assertion.
  const cfg = resolveConfig({ budgets: { pinned: itemCost(items[0]) } });

  const sel = select(items, { event: 'session-start' }, cfg);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a'],
    'the fixture must deliver something, or this is not the partial case');
  assert.notEqual(sel.pinnedSpill, null);
  assert.deepEqual(sel.pinnedSpill?.ids, ['CONST-b', 'CONST-c']);
  assert.equal(sel.pinnedSpill?.cost, whole,
    'the cost is the WHOLE tier — what it would take to honour `always` — not what was admitted');
  assert.equal(sel.pinnedSpill?.budget, cfg.budgets.pinned);
});

test('a pinned tier that fits entirely discloses nothing — there is nothing to disclose', () => {
  const sel = select(
    [item({ id: 'CONST-a', always: true }), item({ id: 'CONST-b', always: true })],
    { event: 'session-start' },
    resolveConfig({ budgets: { pinned: 10_000 } }),
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a', 'CONST-b']);
  assert.equal(sel.pinnedSpill, null);
});

/**
 * The mutation this file exists to catch: a disclosure that fires only when the
 * WHOLE tier spills reports nothing for the case that actually happened. Seven
 * of twenty-three is a partial always, and a partial always is the only one
 * that reads as kept while being broken.
 */
test('every pinned item spilling is disclosed too, and by the same rule as one', () => {
  const items = [item({ id: 'CONST-a', always: true }), item({ id: 'CONST-b', always: true })];
  const cfg = resolveConfig({ budgets: { pinned: 1 } });
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full, []);
  assert.deepEqual(sel.pinnedSpill?.ids, ['CONST-a', 'CONST-b']);
  assert.equal(sel.pinnedSpill?.budget, 1);
});

/**
 * ONLY the pinned tier. `jit`, `restored` and `index` spill by design — a JIT
 * budget is a per-tool-call bound and an index line is a title, not a promise —
 * and widening this disclosure to them would make it a routine line nobody
 * reads, which is how the one tier that matters stops being heard.
 */
test('an index spill is not a pinned spill', () => {
  const cfg = resolveConfig({ budgets: { index: 20, pinned: 10_000 } });
  const sel = select(
    [item({ id: 'CONST-a' }), item({ id: 'CONST-b' }), item({ id: 'CONST-c' })],
    { event: 'session-start' },
    cfg,
  );
  assert.ok(sel.spilled.some((s) => s.tier === 'index'), 'fixture must spill an index line');
  assert.equal(sel.pinnedSpill, null);
});

test('a jit spill is not a pinned spill', () => {
  const cfg = resolveConfig({ budgets: { jit: 1 } });
  const sel = select(
    [item({ id: 'CONST-a', scope: ['src/**'] })],
    { event: 'tool', path: 'src/index.ts' },
    cfg,
  );
  assert.deepEqual(sel.spilled.map((s) => s.tier), ['jit']);
  assert.equal(sel.pinnedSpill, null);
});

/**
 * A tier that did not run has nothing to disclose, and that is a different fact
 * from a tier that ran and fitted. Both answer `null` here because both
 * delivered every pinned item they were asked for — none — and `tiersRun` is
 * where "did the tier run" is answered.
 */
test('a tool event, whose pinned tier never runs, discloses nothing', () => {
  const sel = select(
    [item({ id: 'CONST-a', always: true })],
    { event: 'tool', path: 'src/index.ts' },
    resolveConfig({ budgets: { pinned: 1 } }),
  );
  assert.equal(sel.pinnedSpill, null);
});

/**
 * The `trueSpills` correction, carried into this disclosure.
 *
 * An item can spill from `pinned` and still be admitted by a later tier — on a
 * compaction the `restored` tier runs after it, with its own budget. The item
 * REACHED the session, so naming it as undelivered would be a false alarm on
 * the one channel this feature needs to stay credible.
 */
test('a pinned item the restored tier then admitted is not named as undelivered', () => {
  const items = [item({ id: 'CONST-a', always: true }), item({ id: 'CONST-b', always: true })];
  const cfg = resolveConfig({
    budgets: { pinned: itemCost(items[0]), restored: 10_000 },
  });
  const sel = select(
    items, { event: 'compact', restore: ['CONST-b'] }, cfg,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id).sort(), ['CONST-a', 'CONST-b']);
  assert.equal(sel.pinnedSpill, null,
    'CONST-b spilled from pinned and arrived via restored — it is not missing');
});
