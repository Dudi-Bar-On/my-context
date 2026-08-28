/**
 * Focus inside `select` — the filter, and the report it produces.
 *
 * The point of every case here is that focus is applied in ONE place. If it
 * ever grew a second implementation (a preview that re-derived the predicate, a
 * hook that filtered before calling `select`), these are the assertions that
 * would keep passing while the product diverged — so several of them
 * deliberately check the parts a second implementation would be most likely to
 * get wrong: the index, the whole-corpus counts, and the two universes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import type { Focus } from '../../src/core/focus.ts';
import { select } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

/**
 * **`always: true` is deliberate here and it is NOT the ordinary item.**
 *
 * These tests read `sel.full`, and only the pinned tier lands there on a
 * session-start event — an `always: false` item of the same shape is an index
 * line, so a fixture that dropped the flag would leave every assertion below
 * comparing empty arrays and passing.
 *
 * The cost, which cost six tests on 2026-08-27 when `focusHides` stopped hiding
 * pinned items per the owner's ruling: a file whose every fixture is pinned
 * tests focus AS APPLIED TO PINNED ITEMS and reads as though it tested focus in
 * general. The tests below that are about HIDING therefore say `always: false`
 * explicitly and assert on `focus.hidden` and the index — which is where an
 * ordinary item's narrowing is now visible, and where it always actually was.
 *
 * Measured on the real corpus the same day: 24 items are pinned and 584 are
 * not, so the exemption protects four per cent and focus still narrows the
 * rest. The rule is narrow; this fixture was not.
 */
function item(over: Partial<Item> = {}): Item {
  return {
    id: 'RULE-a', type: 'rule', title: 'A rule', status: 'active',
    severity: 'soft', always: true, continuity: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/rule/RULE-a.md',
    ...over,
  };
}

function focus(over: Partial<Focus> = {}): Focus {
  return {
    tags: [], categories: [], scope: [], setAt: '2026-08-16T00:00:00.000Z', setBy: 'human',
    ...over,
  };
}

/**
 * An item focus is ALLOWED to hide: normative, injectable, and not pinned.
 *
 * Since the owner's 2026-08-27 ruling, `always: true` exempts an item from
 * focus entirely, so a fixture that is pinned cannot demonstrate hiding — it
 * demonstrates the exemption. Every test below that asserts something was
 * hidden builds its subject with this.
 */
function ordinary(over: Partial<Item> = {}): Item {
  return item({ always: false, continuity: false, ...over });
}

const BILLING = item({ id: 'RULE-billing', tags: ['billing'] });
const AUTH = item({ id: 'RULE-auth', tags: ['auth'] });
const AUTH_ORDINARY = ordinary({ id: 'RULE-auth', tags: ['auth'] });

test('with no focus the report is null — "focus is off" is its own answer', () => {
  const sel = select([BILLING, AUTH], { event: 'session-start' }, CONFIG);
  assert.equal(sel.focus, null);
  assert.equal(sel.full.length, 2);
});

test('an empty focus narrows nothing and still reports nothing', () => {
  const sel = select([BILLING, AUTH], { event: 'session-start', focus: focus() }, CONFIG);
  assert.equal(sel.focus, null, 'a focus with no axes is not a focus');
  assert.equal(sel.full.length, 2);
});

test('a tag focus hides what does not carry the tag, and names it', () => {
  const sel = select(
    [BILLING, AUTH_ORDINARY],
    { event: 'session-start', focus: focus({ tags: ['billing'] }) }, CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['RULE-billing']);
  assert.deepEqual(sel.focus?.hidden, ['RULE-auth']);
  assert.equal(sel.focus?.visible, 1);
});

/**
 * A focus that hides nothing is reported anyway. "Focus is on and cost you
 * nothing" and "focus is off" are different facts, and a session running under
 * a forgotten focus has to be told which one it is in — otherwise the only
 * evidence of a stale focus is an injection that happens to look normal.
 */
test('a focus that hides nothing still reports, so a forgotten focus is visible', () => {
  const sel = select(
    [BILLING], { event: 'session-start', focus: focus({ tags: ['billing'] }) }, CONFIG,
  );
  assert.notEqual(sel.focus, null);
  assert.deepEqual(sel.focus?.hidden, []);
});

test('axes are AND-ed, values within an axis are OR-ed', () => {
  const items = [
    item({ id: 'RULE-b', tags: ['billing'] }),
    item({ id: 'RULE-i', tags: ['invoicing'] }),
    ordinary({ id: 'CONST-b', type: 'constraint', tags: ['billing'] }),
  ];
  const sel = select(items, {
    event: 'session-start',
    focus: focus({ tags: ['billing', 'invoicing'], categories: ['rule'] }),
  }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id).toSorted(), ['RULE-b', 'RULE-i']);
  assert.deepEqual(sel.focus?.hidden, ['CONST-b'], 'the constraint matches the tag but not the category');
});

test('the scope axis takes a path, and an unscoped item stays visible on every path', () => {
  const scoped = item({ id: 'RULE-api', scope: ['src/api/**'] });
  const elsewhere = ordinary({ id: 'RULE-db', scope: ['src/db/**'] });
  const unscoped = item({ id: 'RULE-any' });
  const sel = select([scoped, elsewhere, unscoped], {
    event: 'session-start', focus: focus({ scope: ['src/api/orders.ts'] }),
  }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id).toSorted(), ['RULE-any', 'RULE-api']);
  assert.deepEqual(sel.focus?.hidden, ['RULE-db']);
});

test('the scope axis also takes a glob, matched against the items own globs', () => {
  const scoped = item({ id: 'RULE-api', scope: ['src/api/orders.ts'] });
  const elsewhere = ordinary({ id: 'RULE-db', scope: ['src/db/writer.ts'] });
  const sel = select([scoped, elsewhere], {
    event: 'session-start', focus: focus({ scope: ['src/api/**'] }),
  }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['RULE-api']);
});

/**
 * The exemption, in both directions. A `hard` item that does not match is kept
 * AND disclosed; the positive half alone would pass for a build where focus was
 * simply broken, so the soft item beside it must still be hidden.
 */
test('a severity:hard item is never hidden, and the exemption is reported', () => {
  const hard = item({ id: 'INV-always', type: 'invariant', severity: 'hard', tags: ['auth'] });
  const soft = ordinary({ id: 'RULE-auth', tags: ['auth'] });
  const sel = select([BILLING, hard, soft], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id).toSorted(), ['INV-always', 'RULE-billing']);
  assert.deepEqual(sel.focus?.hidden, ['RULE-auth']);
  assert.deepEqual(sel.focus?.exemptHard, ['INV-always']);
});

/**
 * **A focus may not hide a pinned item, and this is the case that was broken.**
 *
 * `focusHides` exempted `severity: hard` and nothing else, so an item marked
 * `always: true` with SOFT severity was hidden like any other. Measured
 * 2026-08-27: a focus set three days earlier with `tags: plan:walk` had hidden
 * six of them, including the instruction to use this product for every fitting
 * category — hidden by this product, with nothing saying so.
 *
 * Asserted as the PROPERTY rather than the count. "Six were hidden" is true of
 * one day's corpus; "no item marked always is absent under any focus" is true
 * of every corpus, and is what the owner ruled
 * (`DEC-a-focus-may-not-hide-a-pinned-item-focushides-exempts-always`).
 *
 * The soft, unpinned item beside it must still be hidden — without that half
 * this test would pass just as happily against a build where focus did nothing
 * at all.
 */
test('an always:true item is never hidden by focus, whatever its severity', () => {
  const pinnedSoft = item({ id: 'INSTR-pinned', severity: 'soft', always: true, continuity: false, tags: ['auth'] });
  const ordinary = item({ id: 'RULE-auth', severity: 'soft', always: false, continuity: false, tags: ['auth'] });
  const sel = select([BILLING, pinnedSoft, ordinary], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);

  assert.deepEqual(sel.full.map((e) => e.item.id).toSorted(), ['INSTR-pinned', 'RULE-billing'],
    'a pinned item that does not match the focus must still be injected: always means it does '
    + 'not fall out of context, and a focus is a lens rather than a suppressor');
  assert.deepEqual(sel.focus?.hidden, ['RULE-auth'],
    'and the ordinary soft item beside it must still be hidden, or this proves nothing');
});

/**
 * The two exemptions are INDEPENDENT, which is why they are two statements in
 * `focusHides` and two lists in the report. An item can be hard without being
 * pinned and pinned without being hard; a single collapsed condition is one a
 * later edit can drop wholesale while appearing to simplify.
 */
test('the two exemptions are reported apart, and an item that is both is counted once', () => {
  const pinnedSoft = item({ id: 'INSTR-pinned', severity: 'soft', always: true, continuity: false, tags: ['auth'] });
  const hardOnly = item({ id: 'INV-hard', type: 'invariant', severity: 'hard', tags: ['auth'] });
  const both = item({ id: 'INV-both', type: 'invariant', severity: 'hard', always: true, continuity: false, tags: ['auth'] });
  const sel = select([BILLING, pinnedSoft, hardOnly, both], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);

  assert.deepEqual(sel.focus?.exemptHard, ['INV-both', 'INV-hard']);
  assert.deepEqual(sel.focus?.exemptAlways, ['INSTR-pinned'],
    'an item that is BOTH is named under hard alone. Two lines naming one id would read as two '
    + 'items kept, and the point of these lists is that their counts are trustworthy');
});

test('a hard item that DOES match the focus is not reported as an exemption', () => {
  const hard = item({ id: 'INV-b', type: 'invariant', severity: 'hard', tags: ['billing'] });
  const sel = select([hard], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.deepEqual(sel.focus?.exemptHard, []);
});

test('focus narrows the index too, or the index would list what focus hid', () => {
  const hiddenNormative = item({ id: 'RULE-auth', tags: ['auth'], always: false });
  const sel = select([BILLING, hiddenNormative], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.deepEqual(sel.index.normative.map((n) => n.id), []);
  assert.deepEqual(sel.focus?.hidden, ['RULE-auth']);
});

test('focus narrows the rationale counts as well as the normative lines', () => {
  const lesson = item({ id: 'LESSON-a', type: 'lesson', tags: ['auth'], always: false });
  const kept = item({ id: 'LESSON-b', type: 'lesson', tags: ['billing'], always: false });
  const sel = select([lesson, kept], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.equal(sel.index.counts.lesson, 1);
  assert.deepEqual(sel.focus?.hidden, ['LESSON-a']);
});

/**
 * The counts focus must NOT touch. `drafts` and `retired` are counts of what is
 * not being injected in the first place; narrowing them would make a focus look
 * like it had emptied the review queue.
 */
test('focus does not change the draft or retired counts — they count another universe', () => {
  const draft = item({ id: 'RULE-draft', status: 'draft', tags: ['auth'] });
  const retired = item({ id: 'RULE-old', status: 'superseded', tags: ['auth'] });
  const sel = select([BILLING, draft, retired], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.equal(sel.index.drafts, 1);
  assert.equal(sel.index.retired, 1);
});

// --- the two universes --------------------------------------------------------

test('a session start counts the whole eligible corpus', () => {
  const sel = select([BILLING, AUTH_ORDINARY], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.equal(sel.focus?.universe, 'corpus');
  assert.deepEqual(sel.focus?.hidden, ['RULE-auth']);
});

/**
 * On a tool event the only items that could have been delivered are the ones
 * that apply to the path. Counting the rest would report a cost this event was
 * never going to pay — the number would name items the session was not about to
 * see under any focus at all.
 */
test('a tool event counts only the items that apply to the path it touched', () => {
  const here = item({ id: 'RULE-here', tags: ['auth'], scope: ['src/api/**'], always: false });
  const elsewhere = item({ id: 'RULE-there', tags: ['auth'], scope: ['src/db/**'], always: false });
  const sel = select([here, elsewhere], {
    event: 'tool', path: 'src/api/orders.ts', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.equal(sel.focus?.universe, 'path');
  assert.deepEqual(
    sel.focus?.hidden, ['RULE-here'],
    'RULE-there is hidden by focus too, but it was never a candidate for THIS file',
  );
});

// --- dangling relations -------------------------------------------------------

test('the report counts the load-bearing relation focus left dangling', () => {
  const openq = item({
    id: 'OPENQ-x', type: 'open_question', tags: ['design'], always: false, continuity: false,
    relations: [{ type: 'blocks', target: 'REQ-y' }],
  });
  const req = item({ id: 'REQ-y', type: 'requirement', tags: ['billing'], always: false });
  const sel = select([openq, req], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.deepEqual(sel.focus?.dangling, [
    { from: 'OPENQ-x', type: 'blocks', to: 'REQ-y', hiddenEnd: 'from' },
  ]);
  assert.deepEqual(
    sel.full.map((e) => e.item.id), [],
    'and it is still hidden: focus discloses and allows, it does not refuse',
  );
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['REQ-y']);
});

test('a referential relation into hidden knowledge is not reported as a cost', () => {
  const lesson = item({ id: 'LESSON-a', type: 'lesson', tags: ['auth'], always: false });
  const rule = item({
    id: 'RULE-b', tags: ['billing'], always: false, continuity: false,
    relations: [{ type: 'derived_from', target: 'LESSON-a' }],
  });
  const sel = select([lesson, rule], {
    event: 'session-start', focus: focus({ tags: ['billing'] }),
  }, CONFIG);
  assert.deepEqual(sel.focus?.hidden, ['LESSON-a']);
  assert.deepEqual(sel.focus?.dangling, []);
});
