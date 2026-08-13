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

test('risk is rationale, policy and postmortem and taxonomy are off by default', () => {
  assert.equal(CATEGORIES.risk.tier, 'rationale');
  for (const name of ['policy', 'postmortem', 'taxonomy']) {
    assert.equal(CATEGORIES[name].defaultEnabled, false, name);
  }
});

test('profiles have the documented sizes', () => {
  assert.equal(PROFILES.minimal.length, 8);
  assert.equal(PROFILES.standard.length, 17);
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
    ['policy', 'POL', 'normative', false],
    ['adr', 'ADR', 'rationale', true],
    ['decision', 'DEC', 'rationale', true],
    ['lesson', 'LESSON', 'rationale', true],
    ['tradeoff', 'TRADE', 'rationale', true],
    ['assumption', 'ASSUME', 'rationale', true],
    ['edge_case', 'EDGE', 'rationale', true],
    ['risk', 'RISK', 'rationale', true],
    ['postmortem', 'PM', 'rationale', false],
    ['taxonomy', 'TAX', 'rationale', false],
  ]);
});
