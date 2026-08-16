import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, PROFILES } from '../../src/core/categories.ts';

test('there are 20 categories', () => {
  assert.equal(Object.keys(CATEGORIES).length, 20);
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
 * them. Nothing ships switched off any more, so `standard` and `full` resolve
 * to the same set.
 *
 * Asserted rather than left implicit for two reasons. A category re-added with
 * `defaultEnabled: false` fails here, which is where the decision should be
 * re-argued; and both READMEs now state that the standard profile enables the
 * whole catalogue, which is only true while this holds.
 */
test('the catalogue ships no category disabled by default', () => {
  const off = Object.values(CATEGORIES).filter((c) => !c.defaultEnabled).map((c) => c.name);
  assert.deepEqual(off, []);
  assert.deepEqual([...PROFILES.standard].sort(), [...PROFILES.full].sort());
});

test('the three removed categories are gone from the catalogue', () => {
  for (const name of ['policy', 'postmortem', 'taxonomy']) {
    assert.equal(Object.hasOwn(CATEGORIES, name), false, `${name} is still in the catalogue`);
  }
});

test('profiles have the documented sizes', () => {
  assert.equal(PROFILES.minimal.length, 8);
  assert.equal(PROFILES.standard.length, 20);
  assert.equal(PROFILES.full.length, 20);
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
// table pins (name, prefix, tier, defaultEnabled) for all 20 categories so
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
    ['adr', 'ADR', 'rationale', true],
    ['decision', 'DEC', 'rationale', true],
    ['lesson', 'LESSON', 'rationale', true],
    ['tradeoff', 'TRADE', 'rationale', true],
    ['assumption', 'ASSUME', 'rationale', true],
    ['edge_case', 'EDGE', 'rationale', true],
    ['risk', 'RISK', 'rationale', true],
    ['known_issue', 'KNOWN', 'rationale', true],
  ]);
});
