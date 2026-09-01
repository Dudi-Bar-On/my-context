/**
 * The JIT tier offers path-scoped items first, in two bands
 * (`DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands`).
 *
 * `matchesScope` returns a BOOLEAN, so *"this item declares `reports/**` and
 * the path is `reports/V2-HANDOVER.md`"* and *"this item declares nothing"*
 * used to arrive at the budget as the same answer. Measured against the real
 * corpus on 2026-08-28, on the path `reports/V2-HANDOVER.md`: the item scoped
 * to `reports/**` SPILLED while 27 items about nothing in particular were
 * delivered, and 619 of 621 items carry `scope: []`.
 *
 * **The first test in this file is the one the ruling turns on**, and it is
 * not written the way the others are. Its expectation is a VERBATIM CAPTURE
 * of what the single-band selector answered for that corpus, taken before the
 * banding existed and pasted in unchanged. It is deliberately not derived from
 * the current code, not recomputed, and not a shape assertion: the ruling was
 * made on the ground that a corpus which does not use scope cannot regress,
 * and the only evidence for that is the old answer written down independently
 * and still matching.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

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

const body = (n: number) => 'x'.repeat(n);

/** The measured path: the one a scoped item lost on. */
const PATH = 'reports/V2-HANDOVER.md';

/**
 * An entirely UNSCOPED corpus — the shape 619 of 621 real items have.
 *
 * It is built to be a discriminator rather than a smoke test. Severities,
 * layers and ids are mixed so `byPriority` has all three of its keys to
 * exercise; the sizes are chosen so the answer is NOT a priority prefix —
 * `RULE-charlie` spills at 824 and three smaller, lower-priority items are
 * admitted after it, which is `fitToBudget`'s first-fit rule and the thing a
 * re-ordering is most likely to break silently.
 */
const UNSCOPED_CORPUS: Item[] = [
  item({ id: 'CONST-alpha', severity: 'hard', body: body(1200) }),
  item({ id: 'CONST-bravo', severity: 'soft', body: body(400) }),
  item({
    id: 'RULE-charlie', type: 'rule', severity: 'hard', body: body(2000),
    filePath: 'items/rule/RULE-charlie.md',
  }),
  item({ id: 'CONST-delta', severity: 'soft', body: body(160) }),
  item({
    id: 'REQ-echo', type: 'requirement', severity: 'soft', body: body(800),
    filePath: 'items/requirement/REQ-echo.md',
  }),
  item({ id: 'CONST-foxtrot', severity: 'hard', layer: 'global', body: body(600) }),
  item({
    id: 'RULE-golf', type: 'rule', severity: 'soft', body: body(120),
    filePath: 'items/rule/RULE-golf.md',
  }),
  item({ id: 'CONST-hotel', severity: 'soft', body: body(2400) }),
];

/**
 * CAPTURED FROM THE SINGLE-BAND SELECTOR, BEFORE THE BANDING WAS WRITTEN.
 *
 * Do not regenerate this from the code it is checking. If a change makes this
 * literal wrong, the answer is not to re-capture it: an unscoped corpus
 * delivering something else is the regression the ruling promised could not
 * happen, and re-capturing would erase the only record that it did.
 */
const CAPTURED_BEFORE = {
  full: [
    { id: 'CONST-alpha', tier: 'jit' },
    { id: 'CONST-foxtrot', tier: 'jit' },
    { id: 'CONST-bravo', tier: 'jit' },
    { id: 'CONST-delta', tier: 'jit' },
    { id: 'RULE-golf', tier: 'jit' },
  ],
  spilled: [
    { id: 'RULE-charlie', tier: 'jit', reason: 'budget exceeded (824 > 700 estimated tokens)' },
    { id: 'CONST-hotel', tier: 'jit', reason: 'budget exceeded (1255 > 700 estimated tokens)' },
    { id: 'REQ-echo', tier: 'jit', reason: 'budget exceeded (854 > 700 estimated tokens)' },
  ],
  tokens: 683,
};

test('an unscoped corpus delivers byte-identically to the captured pre-banding answer', () => {
  const config = resolveConfig({ budgets: { jit: 700 } });
  const sel = select(UNSCOPED_CORPUS, { event: 'tool', path: PATH }, config);

  assert.deepEqual(
    {
      full: sel.full.map((e) => ({ id: e.item.id, tier: e.tier })),
      spilled: sel.spilled,
      tokens: sel.tokens,
    },
    CAPTURED_BEFORE,
    'band 1 is empty here, so the admitted set, its ORDER, every spill record and every spill ' +
    'REASON STRING must be what the single-band selector answered — the property the ruling ' +
    'was decided on',
  );
});

/**
 * The assertion that fails on the pre-banding selector, modelled on the real
 * measurement: one item scoped to the event path, unscoped competitors, and a
 * budget too small for both.
 *
 * `CONST-aunscoped` is `hard` and sorts first on every key `byPriority` has —
 * severity, then layer, then id — so under one band it took the budget and the
 * scoped item spilled. That is the defect, spelled as a fixture: the scoped
 * item is the ONLY one that could not have been about anything else.
 */
test('a scoped item is delivered ahead of unscoped competitors on its own path', () => {
  const config = resolveConfig({ budgets: { jit: 600 } });
  const items = [
    item({ id: 'CONST-aunscoped', severity: 'hard', body: body(1600) }),
    item({ id: 'CONST-scoped', severity: 'soft', scope: ['reports/**'], body: body(1600) }),
  ];
  const sel = select(items, { event: 'tool', path: PATH }, config);

  assert.deepEqual(
    sel.full.map((e) => e.item.id), ['CONST-scoped'],
    'the item whose own glob names this path gets first refusal on the budget',
  );
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-aunscoped']);
  assert.equal(sel.spilled[0].tier, 'jit');
  assert.match(
    sel.spilled[0].reason, /> 600 estimated tokens/,
    'the spill is still measured against the tier\'s CONFIGURED budget — bands share one ' +
    'running total, so no reason string quotes a remainder nobody set',
  );
});

/**
 * "One added glob demotes everything else" was the argument against, and the
 * answer is that it demotes nothing: band 2 competes for whatever band 1 left,
 * on the same first-fit terms it always had.
 */
test('band 2 still fills what band 1 leaves — nothing is demoted, only offered later', () => {
  const config = resolveConfig({ budgets: { jit: 600 } });
  const items = [
    item({ id: 'CONST-aunscoped', severity: 'hard', body: body(1600) }),
    item({ id: 'CONST-scoped', severity: 'soft', scope: ['reports/**'], body: body(1600) }),
    item({ id: 'CONST-zsmall', severity: 'soft', body: body(80) }),
  ];
  const sel = select(items, { event: 'tool', path: PATH }, config);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-scoped', 'CONST-zsmall']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-aunscoped']);
});

/**
 * Banding is a stable PARTITION, never a sort. The selector's candidate order
 * is load-bearing — `preview.js`'s header records that `[4,9,4]` at a budget
 * of 10 spills a different item than `[9,1,5]` does — so within a band
 * `byPriority` must still decide, untouched, on all three of its keys.
 */
test('within a band the existing candidate order is preserved exactly', () => {
  const config = resolveConfig({ budgets: { jit: 100_000 } });
  const items = [
    item({ id: 'CONST-zscoped-soft', severity: 'soft', scope: ['reports/**'] }),
    item({ id: 'CONST-ascoped-soft', severity: 'soft', scope: ['reports/**'] }),
    item({ id: 'CONST-scoped-hard', severity: 'hard', scope: ['reports/**'] }),
    item({ id: 'CONST-scoped-global', severity: 'hard', layer: 'global', scope: ['reports/**'] }),
    item({ id: 'CONST-zplain', severity: 'soft' }),
    item({ id: 'CONST-aplain', severity: 'soft' }),
    item({ id: 'CONST-plain-hard', severity: 'hard' }),
  ];
  const sel = select(items, { event: 'tool', path: PATH }, config);

  assert.deepEqual(sel.full.map((e) => e.item.id), [
    // Band 1, in `byPriority` order: hard before soft, project before global,
    // then the ordinal id tiebreak.
    'CONST-scoped-hard', 'CONST-scoped-global', 'CONST-ascoped-soft', 'CONST-zscoped-soft',
    // Band 2, in exactly the same order it would have had on its own.
    'CONST-plain-hard', 'CONST-aplain', 'CONST-zplain',
  ]);
});

/**
 * `scopePolicy: 'inert'` is the owner's lever and this ruling does not pull
 * it. Under `inert` an unscoped item matches NO path, so it never reaches the
 * banding at all and band 2 is empty BY CONSTRUCTION. Checked rather than
 * assumed, because "empty by construction" is the kind of claim that stops
 * being true silently.
 */
test('under scopePolicy inert band 2 is empty by construction and the banding degenerates', () => {
  const config = resolveConfig({
    budgets: { jit: 600 },
    categories: { constraint: { scopePolicy: 'inert' } },
  });
  const items = [
    item({ id: 'CONST-aunscoped', severity: 'hard', body: body(1600) }),
    item({ id: 'CONST-scoped', severity: 'soft', scope: ['reports/**'], body: body(1600) }),
  ];
  const sel = select(items, { event: 'tool', path: PATH }, config);

  assert.deepEqual(
    sel.full.map((e) => e.item.id), ['CONST-scoped'],
    'the scoped item is unaffected by the policy — inert governs the empty case only',
  );
  assert.deepEqual(
    sel.spilled, [],
    'the unscoped item is not a candidate at all under inert, so it neither competes nor ' +
    'spills — a band-2 spill record here would mean the policy had been re-implemented in ' +
    'the banding',
  );
});

/**
 * The banding must not reach the CONTINUITY tier. Continuity draws from
 * `eligible` and answers "what does the next session need in order not to
 * start over", which no file path scopes; it never consulted `matchesScope`
 * and must not begin to. Its item is scoped here precisely so that a banding
 * that leaked would have something to sort on.
 */
test('the continuity tier is untouched — it is not scope-matched and does not band', () => {
  const config = resolveConfig({});
  const items = [
    item({
      id: 'REF-handover', type: 'reference', continuity: true, scope: ['src/**'],
      filePath: 'items/reference/REF-handover.md',
    }),
    item({ id: 'CONST-pinned', always: true }),
  ];
  const sel = select(items, { event: 'session-start' }, config);

  assert.deepEqual(
    sel.full.map((e) => ({ id: e.item.id, tier: e.tier })),
    [{ id: 'CONST-pinned', tier: 'pinned' }, { id: 'REF-handover', tier: 'continuity' }],
    'continuity delivers an item whose globs match no path on this event, in the pinned-then-' +
    'continuity run order — the jit tier does not run on a session start and its banding ' +
    'reaches nothing here',
  );
});

/**
 * The pinned tier never consults `matchesScope` (spec §4b, and `select.ts`'s
 * own comment), so `always` is unaffected in either direction. Asserted so no
 * future reading of this file implies otherwise.
 */
test('the pinned tier neither bands nor consults scope', () => {
  const config = resolveConfig({});
  const items = [
    item({ id: 'CONST-pinned-elsewhere', always: true, scope: ['src/db/**'] }),
    item({ id: 'CONST-pinned-here', always: true, scope: ['reports/**'] }),
  ];
  const sel = select(items, { event: 'session-start' }, config);

  assert.deepEqual(
    sel.full.map((e) => e.item.id),
    ['CONST-pinned-elsewhere', 'CONST-pinned-here'],
    'both pin, in `byPriority` order and not in any band order — the pinned tier is scope-blind',
  );
  assert.deepEqual(sel.full.map((e) => e.tier), ['pinned', 'pinned']);
});
