/**
 * **`Spill.band` — the band an item was OFFERED in, written where the offer
 * was made.**
 *
 * `DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands` shipped a
 * reordering with no way to see it: on a tool event a scoped item now takes
 * the budget ahead of an unscoped one, and every surface drawing the result
 * showed a different answer with no reason beside it. The ruling itself named
 * the fix — *"band membership is a fact a screen can display beside each
 * spilled item"* — and left `Spill` unchanged because no consumer existed. The
 * preview's spilled-items list (`plan:walk seq:56`) is that consumer.
 *
 * **What these tests hold, and it is one property with three faces:**
 *
 *  1. The band is `fitToBudget`'s own band INDEX, 1-based, not a re-derivation
 *     from an item's scope. `test/ui`'s screens and `screens/preview.js` read
 *     this field and compare nothing; a second implementation of the
 *     partition is the two-spellings defect this project keeps paying for.
 *  2. It is ABSENT wherever the candidates were not actually split. That is
 *     `STD-absent-vs-zero`, and it is also the ruling's own decisive property
 *     restated: where nothing is scoped there is ONE run of candidates and the
 *     records are byte-identical to the pre-banding selector's — which
 *     `select-jit-bands.test.ts` holds against a verbatim capture taken before
 *     the banding existed. A `band: 1` stamped on every single-band tier would
 *     have broken that capture while reporting a partition nobody made.
 *  3. No tier but `jit` bands anything today, so no other tier's spills carry
 *     the field. Asserted rather than assumed: `fitToBudget` is shared, and a
 *     future caller that starts passing two bands should have to come here.
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

/** The path the ruling was measured on. */
const PATH = 'reports/V2-HANDOVER.md';

test('a spill from band 2 says so, and the scoped item that displaced it is delivered', () => {
  const config = resolveConfig({ budgets: { jit: 600 } });
  const items = [
    item({ id: 'CONST-aunscoped', severity: 'hard', body: body(1600) }),
    item({ id: 'CONST-scoped', severity: 'soft', scope: ['reports/**'], body: body(1600) }),
  ];
  const sel = select(items, { event: 'tool', path: PATH }, config);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-scoped']);
  assert.equal(
    sel.spilled[0]?.band, 2,
    'the item that lost was offered SECOND because it declares no scope — the whole of what a ' +
    'reader could not see before, and it is read off the offer rather than re-derived from the ' +
    'item and the path',
  );
});

test('a spill from band 1 says 1 — the number is the position, not a verdict on scope', () => {
  // Two scoped items, one small unscoped one. Band 1 overruns on its own, so
  // the record has to name the FIRST band. A field that meant "unscoped" would
  // be wrong here in the direction nobody would check.
  const config = resolveConfig({ budgets: { jit: 700 } });
  const items = [
    item({ id: 'CONST-scoped-big', severity: 'hard', scope: ['reports/**'], body: body(4000) }),
    item({ id: 'CONST-scoped-small', severity: 'soft', scope: ['reports/**'], body: body(200) }),
    item({ id: 'CONST-plain', severity: 'soft', body: body(200) }),
  ];
  const sel = select(items, { event: 'tool', path: PATH }, config);

  assert.deepEqual(
    sel.spilled.map((s) => ({ id: s.id, band: s.band })),
    [{ id: 'CONST-scoped-big', band: 1 }],
    'the only spill is a band-1 item, and band 2 filled what it left — first-fit, unchanged',
  );
  assert.deepEqual(
    sel.full.map((e) => e.item.id), ['CONST-scoped-small', 'CONST-plain'],
  );
});

test('an unscoped corpus carries NO band — one populated band is not a partition', () => {
  const config = resolveConfig({ budgets: { jit: 700 } });
  const items = [
    item({ id: 'CONST-alpha', severity: 'hard', body: body(1200) }),
    item({ id: 'CONST-bravo', severity: 'soft', body: body(400) }),
    item({ id: 'RULE-charlie', type: 'rule', severity: 'hard', body: body(2000),
      filePath: 'items/rule/RULE-charlie.md' }),
  ];
  const sel = select(items, { event: 'tool', path: PATH }, config);

  assert.ok(sel.spilled.length > 0, 'the fixture must spill for this to be measuring anything');
  for (const spill of sel.spilled) {
    assert.ok(
      !('band' in spill),
      `${spill.id} carries a band on a corpus where band 1 is empty. The key must be ABSENT, ` +
      'not 2: the ruling was decided on these records being byte-identical to the pre-banding ' +
      'selector\'s, which is what `select-jit-bands.test.ts` captures verbatim',
    );
  }
});

test('the pinned tier passes one band, so its spills carry no band either', () => {
  const config = resolveConfig({ budgets: { pinned: 300 } });
  const items = [
    item({ id: 'CONST-pinned-big', always: true, severity: 'hard', body: body(2000) }),
    item({ id: 'CONST-pinned-small', always: true, severity: 'soft', body: body(80) }),
  ];
  const sel = select(items, { event: 'session-start' }, config);

  const pinned = sel.spilled.filter((s) => s.tier === 'pinned');
  assert.ok(pinned.length > 0, 'the pinned budget must bite for this to be measuring anything');
  for (const spill of pinned) {
    assert.ok(
      !('band' in spill),
      'only the jit tier bands today; a band on a pinned spill would be a number describing a ' +
      'partition `select` never made',
    );
  }
});

test('the index tier bands nothing — its spills are lines, and they carry no band', () => {
  // Normative categories, because `IndexSummary.normative` is the only list
  // that spills at tier `index` — a rationale item never reaches a line to
  // lose. They are not `always`, so on a session start the pinned tier passes
  // over them and the index is where they arrive.
  const config = resolveConfig({ budgets: { index: 20 } });
  const items = [
    item({ id: 'CONST-alpha', title: 'A constraint with a long enough title to cost real tokens',
      filePath: 'items/constraint/CONST-alpha.md' }),
    item({ id: 'CONST-bravo', title: 'Another constraint, also long enough to cost real tokens',
      filePath: 'items/constraint/CONST-bravo.md' }),
    item({ id: 'CONST-charlie', title: 'A third constraint, longer again than both the others',
      filePath: 'items/constraint/CONST-charlie.md' }),
  ];
  const sel = select(items, { event: 'session-start' }, config);

  const indexSpills = sel.spilled.filter((s) => s.tier === 'index');
  assert.ok(indexSpills.length > 0, 'the index budget must bite for this to be measuring anything');
  for (const spill of indexSpills) {
    assert.ok(
      !('band' in spill), 'an index line is not banded and must not be described as if it were',
    );
  }
});

test('the band survives serialization — it is a plain number on the wire', () => {
  const config = resolveConfig({ budgets: { jit: 600 } });
  const items = [
    item({ id: 'CONST-aunscoped', severity: 'hard', body: body(1600) }),
    item({ id: 'CONST-scoped', severity: 'soft', scope: ['reports/**'], body: body(1600) }),
  ];
  const sel = select(items, { event: 'tool', path: PATH }, config);

  // `/api/select` is `select()`'s JSON serialization and nothing else, so what
  // the browser reads is exactly this round trip. An `undefined` own property
  // would vanish here and a non-JSON value would arrive as something else;
  // both are the shape change a screen would only find at runtime.
  const overTheWire = JSON.parse(JSON.stringify(sel.spilled)) as { id: string; band?: number }[];
  assert.deepEqual(overTheWire.map((s) => s.band), [2]);
});
