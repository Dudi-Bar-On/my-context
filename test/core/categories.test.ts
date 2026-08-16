import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, PROFILES } from '../../src/core/categories.ts';

test('there are 21 categories', () => {
  assert.equal(Object.keys(CATEGORIES).length, 21);
});

test('prefixes are unique and uppercase', () => {
  const prefixes = Object.values(CATEGORIES).map((c) => c.prefix);
  assert.equal(new Set(prefixes).size, prefixes.length);
  for (const p of prefixes) assert.equal(p, p.toUpperCase());
});

test('agent-facing categories are normative and enabled', () => {
  for (const name of ['instruction', 'non_goal', 'open_question']) {
    assert.equal(CATEGORIES[name].tier, 'normative', name);
    assert.equal(CATEGORIES[name].defaultEnabled, true, name);
  }
});

test('risk is rationale', () => {
  assert.equal(CATEGORIES.risk.tier, 'rationale');
});

/**
 * Phase 3 removed `policy`, `postmortem` and `taxonomy` — each duplicated a
 * clearer sibling, and since `type` is fixed at creation two overlapping types
 * enabled at once means the same fact filed twice with no way to reconcile
 * them. Nothing ships switched off any more.
 *
 * Asserted rather than left implicit for two reasons. A category re-added with
 * `defaultEnabled: false` fails here, which is where the decision should be
 * re-argued; and both READMEs now state that the standard profile enables the
 * whole catalogue, which is only true while this holds.
 */
test('the catalogue ships no category disabled by default', () => {
  const off = Object.values(CATEGORIES).filter((c) => !c.defaultEnabled).map((c) => c.name);
  assert.deepEqual(off, []);
});

/**
 * `full` was removed, not renamed and not aliased.
 *
 * It meant "every category in the catalogue" where `standard` means "every
 * category enabled by default", and the whole of the difference was the three
 * categories above. With those gone the two names were synonyms, and a second
 * name for the same twenty categories is a thing a reader has to be told means
 * nothing. Kept as an alias it would have been worse than removed: a project
 * pinning `"profile": "full"` would go on resolving, silently, to a name the
 * documentation no longer explains.
 *
 * The refusal is asserted in `test/core/config.test.ts`; what is pinned here
 * is that the name is not in the table at all, so re-adding it has to be a
 * decision rather than a merge.
 */
test('the profiles are exactly minimal and standard', () => {
  assert.deepEqual(Object.keys(PROFILES), ['minimal', 'standard']);
  assert.equal(Object.hasOwn(PROFILES, 'full'), false);
});

test('the three removed categories are gone from the catalogue', () => {
  for (const name of ['policy', 'postmortem', 'taxonomy']) {
    assert.equal(Object.hasOwn(CATEGORIES, name), false, `${name} is still in the catalogue`);
  }
});

test('profiles have the documented sizes', () => {
  assert.equal(PROFILES.minimal.length, 8);
  assert.equal(PROFILES.standard.length, 21);
});

test('every profile entry names a real category', () => {
  for (const list of Object.values(PROFILES)) {
    for (const name of list) assert.ok(CATEGORIES[name], `unknown category ${name}`);
  }
});

test('requirement declares the kind field', () => {
  assert.deepEqual(CATEGORIES.requirement.extraFields, ['kind']);
});

// A silent tier flip (e.g. `lesson` promoted to normative) would start
// injecting the whole rationale corpus in full text on every session. This
// table pins (name, prefix, tier, defaultEnabled) for all 21 categories so
// such a change cannot land unnoticed.
test('the full (name, prefix, tier, defaultEnabled) table is pinned', () => {
  const table = Object.values(CATEGORIES).map((c) => [c.name, c.prefix, c.tier, c.defaultEnabled]);
  assert.deepEqual(table, [
    ['constraint', 'CONST', 'normative', true],
    ['invariant', 'INV', 'normative', true],
    ['rule', 'RULE', 'normative', true],
    ['requirement', 'REQ', 'normative', true],
    ['standard', 'STD', 'normative', true],
    ['pattern', 'PAT', 'normative', true],
    ['glossary', 'GLOSS', 'normative', true],
    ['instruction', 'INSTR', 'normative', true],
    ['non_goal', 'NOGOAL', 'normative', true],
    ['open_question', 'OPENQ', 'normative', true],
    ['runbook', 'RUN', 'normative', true],
    ['environment', 'ENV', 'normative', true],
    // Normative, and it shipped rationale. A rationale item is never injected
    // in full AND is not named in the session index — `buildIndex` reduces the
    // whole tier to counts — so a `known_issue` reached a session as a digit.
    // The category exists to stop an agent chasing something already known to
    // be broken, and it cannot do that from a place the agent never reads.
    ['known_issue', 'KNOWN', 'normative', true],
    ['adr', 'ADR', 'rationale', true],
    ['decision', 'DEC', 'rationale', true],
    ['lesson', 'LESSON', 'rationale', true],
    ['tradeoff', 'TRADE', 'rationale', true],
    ['assumption', 'ASSUME', 'rationale', true],
    ['edge_case', 'EDGE', 'rationale', true],
    ['risk', 'RISK', 'rationale', true],
    // Rationale, and the tier is the trust boundary rather than a taxonomy
    // judgement: a reference's body is a snapshot of a file, so a NORMATIVE
    // one would let whoever can edit that file change what governs this
    // project. A retiering is the user's call and the machinery honours it;
    // what must not happen silently is the catalogue shipping it that way.
    ['reference', 'REF', 'rationale', true],
  ]);
});
