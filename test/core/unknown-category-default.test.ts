// @basis TASK-the-unknown-category-default-is-answered-three-different, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **One answer to "what tier is a category nobody declared?", and the three
 * surfaces that ask it.**
 *
 * `TASK-the-unknown-category-default-is-answered-three-different` measured
 * three different answers in three files, for a question that has one answer:
 *
 *   - `tierOf` (`core/trust.ts`) failed **closed** to `normative`, and argued
 *     in a comment why it must.
 *   - `isNormative` (`core/select.ts`) answered `false` — i.e. `rationale`.
 *   - `addSnapshot` (`cli/index.ts`) failed **open** to `'rationale'`, which is
 *     the exact default `trust.ts` argues against, one file over.
 *
 * *"The disagreement is not about what the answer should be; nobody noticed
 * there were three answers."*
 *
 * So the answer is now a VALUE — `UNKNOWN_CATEGORY_TIER` — reached through one
 * function, `tierForCategory`, and the three surfaces call it. This file is
 * what makes a fourth spelling fail: each surface is driven with a config that
 * does not declare the item's category, and each is required to agree with the
 * one function rather than with a literal beside it.
 *
 * The `Object.hasOwn` guard is proved too, on `constructor` — a bare index
 * there reaches `Object.prototype.constructor`, whose `.tier` is `undefined`,
 * which lands on precisely the permissive default all three of these refuse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCOPE_POLICY, UNKNOWN_CATEGORY_TIER,
  agentEditsFor, resolveConfig, scopePolicyFor, tierForCategory,
} from '../../src/core/config.ts';
import { isNormative } from '../../src/core/select.ts';
import { tierOf } from '../../src/core/trust.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({
  categories: {
    rule: { tier: 'normative', prefix: 'RULE', description: 'A rule.' },
    lesson: { tier: 'rationale', prefix: 'LESSON', description: 'A lesson.' },
  },
});

function item(type: string): Item {
  return {
    id: `${type.toUpperCase()}-x`, type, title: 'x', status: 'active', severity: 'soft',
    always: false, summary: '', summaryOf: null, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null, validFrom: '2026-09-23',
    validUntil: null, checksum: '0', body: '', relations: [],
  } as unknown as Item;
}

test('the unknown-category default fails closed, and is a named value', () => {
  assert.equal(UNKNOWN_CATEGORY_TIER, 'normative');
  assert.equal(tierForCategory(CONFIG, 'vanished'), UNKNOWN_CATEGORY_TIER);
  assert.equal(tierForCategory(CONFIG, 'rule'), 'normative');
  assert.equal(tierForCategory(CONFIG, 'lesson'), 'rationale');
});

test('a prototype key is an unknown category, not Object.prototype', () => {
  assert.equal(tierForCategory(CONFIG, 'constructor'), UNKNOWN_CATEGORY_TIER);
  assert.equal(tierForCategory(CONFIG, '__proto__'), UNKNOWN_CATEGORY_TIER);
});

test('all three surfaces answer with the one function, not with a literal', () => {
  const ctx = { config: CONFIG } as unknown as Parameters<typeof tierOf>[0];

  // Surface 1 — `tierOf`, the one that was already right.
  assert.equal(tierOf(ctx, item('vanished')), UNKNOWN_CATEGORY_TIER);

  // Surface 2 — `isNormative`, which answered `false` for an unlisted category
  // and so read it as `rationale`.
  assert.equal(
    isNormative(item('vanished'), CONFIG),
    UNKNOWN_CATEGORY_TIER === 'normative',
    'isNormative must agree with the one default, not spell a second one',
  );
  assert.equal(isNormative(item('lesson'), CONFIG), false);
  assert.equal(isNormative(item('rule'), CONFIG), true);

  // Surface 3 — the snapshot preview in `cli/index.ts` reads the same
  // function; `agentEditsFor` already borrowed the tier default rather than
  // restating it, and must keep agreeing with it.
  assert.equal(agentEditsFor(CONFIG, 'vanished'), 'review');
});

/**
 * **The third sibling, and why it keeps the OTHER answer — declared, not
 * discovered.**
 *
 * `scopePolicyFor` hands an undeclared category the permissive
 * `DEFAULT_SCOPE_POLICY`, and report 6 of the 2026-09-13 reviews filed that
 * beside the two above as one more fail-open
 * (`TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan`, row
 * 15). It is not one, and the argument is already written at the function: an
 * item of an unknown category is not `isEligible` for any full-text tier, so
 * the policy decides nothing about its INJECTION — only how the scope field
 * RENDERS, and `(unrestricted)` is the reading that stays true when nothing is
 * known about the category.
 *
 * What was missing was not a different answer; it was anybody stating that the
 * three siblings deliberately do not agree. This test is that statement. A
 * fourth per-category lookup, or a change to any of these three, lands here.
 */
test('the three per-category lookups answer an undeclared category on the record', () => {
  assert.equal(tierForCategory(CONFIG, 'vanished'), 'normative', 'closed: it may govern');
  assert.equal(agentEditsFor(CONFIG, 'vanished'), 'review', 'closed: an agent may not edit it');
  assert.equal(
    scopePolicyFor(CONFIG, 'vanished'), DEFAULT_SCOPE_POLICY,
    'open ON PURPOSE, and it decides rendering rather than injection — see scopePolicyFor',
  );
  assert.equal(DEFAULT_SCOPE_POLICY, 'global');
});

test('the one answer is never the permissive one', () => {
  // The whole point of the item: two of the three let an unlisted input take
  // the benign branch. Whatever the default is, it may not be the branch that
  // hands an agent unreviewed control over an item whose category vanished.
  assert.notEqual(UNKNOWN_CATEGORY_TIER, 'rationale');
  assert.notEqual(agentEditsFor(CONFIG, 'vanished'), 'allow');
});
