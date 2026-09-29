// @basis TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSelection } from '../../src/core/render.ts';
import type { Selection } from '../../src/core/select.ts';

/**
 * **The restore tier's drop reaches the injected block, the way the carry
 * tier's does** — `TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-
 * where`.
 *
 * `renderCarried` already names every carried id that got no index line AND
 * why, in `select`'s own words. A snapshot id that could not be restored is the
 * same fact from the other half of the same mechanism, and until now it reached
 * `--json` and the web UI but not the model — the one reader who has just lost
 * the window those ids were captured from.
 *
 * **It is not filed under the budget headline, and that is the point.** *"N
 * item(s) omitted from full text for budget"* is a true sentence about a
 * candidate that lost to a number, and a false one about a superseded item no
 * budget would ever admit. The two are told apart by `Spill.neverOffered`,
 * never by reading the reason string.
 */

const EMPTY: Selection = {
  full: [],
  index: {
    normative: [], counts: {}, drafts: 0, retired: 0, truncated: 0, ineligible: {},
    carried: null,
  },
  spilled: [],
  pinnedSpill: null,
  continuitySpill: null,
  governingSpill: null,
  focus: null,
  tokens: 0,
};

test('a snapshot id that could not be restored is named in the block, with its reason', () => {
  const out = renderSelection({
    ...EMPTY,
    spilled: [
      { id: 'CONST-gone', tier: 'restored', reason: 'no longer eligible', neverOffered: true },
    ],
  });

  assert.match(out, /CONST-gone/, 'the id is named');
  assert.match(out, /no longer eligible/, "and select's own reason travels with it");
});

test('it is not filed under the budget headline — no budget would have admitted it', () => {
  const out = renderSelection({
    ...EMPTY,
    spilled: [
      { id: 'CONST-gone', tier: 'restored', reason: 'unknown id', neverOffered: true },
    ],
  });

  assert.doesNotMatch(out, /omitted from full text for budget/,
    'a drop that was never offered to a budget is not a budget omission');
});

test('a real budget spill keeps its own sentence, unchanged', () => {
  const out = renderSelection({
    ...EMPTY,
    spilled: [{ id: 'CONST-big', tier: 'restored', reason: 'budget exceeded (9 > 8)' }],
  });

  assert.equal(
    out.trim(),
    '_1 item(s) omitted from full text for budget: CONST-big. Fetch with mycontext show <id>._',
    'the existing wording is byte-identical where nothing new happened',
  );
});

test('both kinds in one selection are told apart, each under its own clause', () => {
  const out = renderSelection({
    ...EMPTY,
    spilled: [
      { id: 'CONST-big', tier: 'restored', reason: 'budget exceeded (9 > 8)' },
      { id: 'CONST-gone', tier: 'restored', reason: 'no longer eligible', neverOffered: true },
    ],
  });

  assert.match(out, /1 item\(s\) omitted from full text for budget: CONST-big\./);
  assert.match(out, /CONST-gone \(no longer eligible\)/);
  // The budget clause counts only the budget loss: a disclosure counted there
  // would inflate the one number a reader uses to judge a budget.
  assert.doesNotMatch(out, /2 item\(s\) omitted from full text for budget/);
});

test('every reason the restore tier can give is printed, and each id is named once', () => {
  const out = renderSelection({
    ...EMPTY,
    spilled: [
      { id: 'CONST-a', tier: 'restored', reason: 'delivered in full this session', neverOffered: true },
      { id: 'CONST-b', tier: 'restored', reason: 'unknown id', neverOffered: true },
      { id: 'CONST-c', tier: 'restored', reason: 'not a normative category', neverOffered: true },
      { id: 'CONST-d', tier: 'restored', reason: 'no longer eligible', neverOffered: true },
      { id: 'CONST-e', tier: 'restored', reason: 'hidden by the active focus', neverOffered: true },
    ],
  });

  for (const [id, reason] of [
    ['CONST-a', 'delivered in full this session'], ['CONST-b', 'unknown id'],
    ['CONST-c', 'not a normative category'], ['CONST-d', 'no longer eligible'],
    ['CONST-e', 'hidden by the active focus'],
  ]) {
    assert.match(out, new RegExp(`${id} \\(${reason}\\)`));
    assert.equal(out.split(id).length - 1, 1, `${id} is named exactly once`);
  }
});

test('a selection with nothing to say still says nothing', () => {
  assert.equal(renderSelection(EMPTY), '');
});
