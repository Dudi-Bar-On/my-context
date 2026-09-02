import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, PROFILES } from '../../src/core/categories.ts';

test('there are 29 categories', () => {
  assert.equal(Object.keys(CATEGORIES).length, 29);
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
 * name for the same catalogue — twenty categories then, twenty-four now — is a
 * thing a reader has to be told means nothing. Kept as an alias it would have
 * been worse than removed: a project pinning `"profile": "full"` would go on
 * resolving, silently, to a name the documentation no longer explains.
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
  assert.equal(PROFILES.standard.length, 29);
});

test('every profile entry names a real category', () => {
  for (const list of Object.values(PROFILES)) {
    for (const name of list) assert.ok(CATEGORIES[name], `unknown category ${name}`);
  }
});

test('requirement declares the kind field', () => {
  assert.deepEqual(CATEGORIES.requirement.extraFields, ['kind']);
});

/**
 * The 2026-09-02 four, each pinned to the fields it was ruled to carry.
 *
 * The extra fields ARE the category here — an `exception` with no `until` is a
 * permanent change to the item it waives, a `measurement` with no `method`
 * cannot be re-taken, a `contract` with no `consumers` is a design note. A
 * field silently dropped from one of these lists would leave the category's
 * name meaning something weaker than the ruling gave it, with every other test
 * in this suite green.
 */
test('the four categories added in 2026-09-02 declare exactly their ruled fields', () => {
  assert.deepEqual(CATEGORIES.measurement.extraFields,
    ['method', 'measured_on', 'subject', 'revision']);
  assert.deepEqual(CATEGORIES.plan.extraFields, ['goal', 'done_when', 'wave', 'state']);
  assert.deepEqual(CATEGORIES.exception.extraFields, ['waives', 'until', 'granted_by', 'reason']);
  assert.deepEqual(CATEGORIES.contract.extraFields, ['consumers', 'stability', 'breaking']);
});

/**
 * Every one of those sixteen fields is DECLARED — what it stores, and a
 * sentence a person reads.
 *
 * `test/core/category-updates-completeness.test.ts` already holds the general
 * rule ("a category with fields of its own must say something about them"),
 * and it is asserted here as well for the same reason `requirement` above is:
 * that file checks a property over the whole catalogue, this one records what
 * these four were ruled to be. A declaration is the only thing `mycontext help
 * categories` and `mycontext examples` can render, so an undeclared field is
 * a field nobody is ever told about.
 */
test('every field the four new categories declare has an update declaration', () => {
  for (const name of ['measurement', 'plan', 'exception', 'contract']) {
    const category = CATEGORIES[name];
    for (const field of category.extraFields) {
      const declared = category.updates[field];
      assert.ok(declared, `${name}.${field} has no update declaration`);
      assert.equal(declared.store, 'field', `${name}.${field} must be a field, not a tag`);
      assert.ok(declared.note.length > 20, `${name}.${field}'s note teaches nothing`);
    }
  }
});

/**
 * **`plan.state` carries no closed vocabulary, and that is a decision rather
 * than an omission.**
 *
 * `task.state` is closed at `todo/doing/blocked/done` because the corpus
 * attests those four. Borrowing them for `plan` would be an inference from a
 * neighbour — the restraint `requirement.kind` and `risk.likelihood` both
 * state — and worse, it would invite the collapse the plan/task boundary
 * exists to prevent: a plan whose state vocabulary is a task's reads as a task.
 */
test('plan.state is deliberately open where task.state is closed', () => {
  assert.deepEqual(CATEGORIES.task.updates.state.values, ['todo', 'doing', 'blocked', 'done']);
  assert.equal(CATEGORIES.plan.updates.state.values, undefined);
  // And it does not project to the `state:` tag `task` generates, which would
  // make one tag mean two different things across two categories.
  assert.equal(CATEGORIES.plan.updates.state.projectsTo, undefined);
  assert.equal(CATEGORIES.task.updates.state.projectsTo, 'state');
});

// A silent tier flip (e.g. `lesson` promoted to normative) would start
// injecting the whole rationale corpus in full text on every session. This
// table pins (name, prefix, tier, defaultEnabled) for all 29 categories so
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
    // NORMATIVE, and beside `runbook` because the pair is the point: a runbook
    // is repeatable and a procedure is one-shot. The tier is what lets a
    // procedure carry a lifecycle — it is injected while it is `active` and
    // stops being injected once it is done — so a flip to rationale here
    // would silently turn the one-shot record into something no session ever
    // reads, which is the `known_issue` defect below in a new costume.
    ['procedure', 'PROC', 'normative', true],
    ['environment', 'ENV', 'normative', true],
    // Normative, and it shipped rationale. A rationale item is never injected
    // in full AND is not named in the session index — `buildIndex` reduces the
    // whole tier to counts — so a `known_issue` reached a session as a digit.
    // The category exists to stop an agent chasing something already known to
    // be broken, and it cannot do that from a place the agent never reads.
    ['known_issue', 'KNOWN', 'normative', true],
    // NORMATIVE, and the tier is the whole of what makes an exception work: it
    // is read at the moment the item it waives is being applied, so it must
    // arrive by the same route. On the rationale tier the rule would be
    // injected in full and the carve-out from it would arrive as a digit in a
    // count — the reader told the rule and not told it does not apply here.
    ['exception', 'EXC', 'normative', true],
    // NORMATIVE, because a contract is a promise made to somebody outside this
    // project and work that breaks it is wrong in the sense the tier means.
    // `CONTRACT` and not `CONTR`: the short form is one letter from `CONST`,
    // and an id prefix that is easy to misread is a prefix that gets misread.
    ['contract', 'CONTRACT', 'normative', true],
    ['adr', 'ADR', 'rationale', true],
    ['decision', 'DEC', 'rationale', true],
    ['lesson', 'LESSON', 'rationale', true],
    ['tradeoff', 'TRADE', 'rationale', true],
    ['assumption', 'ASSUME', 'rationale', true],
    ['edge_case', 'EDGE', 'rationale', true],
    ['risk', 'RISK', 'rationale', true],
    // RATIONALE, and it decides itself: a measurement is a fact about a
    // moment, never an instruction. Nothing an agent does is wrong because a
    // number was once taken — acting on a STALE one would be, which is what
    // `method`, `measured_on`, `subject` and `revision` exist to let a reader
    // judge.
    ['measurement', 'MEAS', 'rationale', true],
    // Rationale, and the tier is the trust boundary rather than a taxonomy
    // judgement: a reference's body is a snapshot of a file, so a NORMATIVE
    // one would let whoever can edit that file change what governs this
    // project. A retiering is the user's call and the machinery honours it;
    // what must not happen silently is the catalogue shipping it that way.
    ['reference', 'REF', 'rationale', true],
    // RATIONALE, beside `task` and NOT the same thing as one. `isWorkCategory`
    // (core/needs.ts) asks for `plan`, `seq` and `state` together; a `plan`
    // declares `state` and neither of the other two, so it is not a work
    // category — it never reaches `mycontext ready`, is never a `needs`
    // target, and none of doctor's task checks reads it. `plan-is-not-a-work-`
    // `item` in test/core/needs.test.ts pins that, because the two names are
    // one letter of config away from being confused.
    ['plan', 'PLAN', 'rationale', true],
    // RATIONALE, and it is the tier that keeps `ready` usable. A task is
    // reasoning ABOUT work rather than a rule the work must satisfy, so it
    // governs nothing; promoting it to normative would inject every open task
    // in full at every session start and name each one in the index — this
    // repository's own outer corpus holds 515 of them. The commands that need
    // tasks (`ready`, `doctor`) read the store directly and never go through
    // `select`, so nothing is lost by keeping it off the governing tier.
    ['task', 'TASK', 'rationale', true],
    // RATIONALE, and deliberately not the tier `procedure` above got. The two
    // are the inbox: a `todo` records an intention and a `note` records
    // something noticed, and neither asserts anything a future session should
    // be made to obey. Promoting either to normative would inject a list of
    // unbuilt things in full at every session start and would draft-gate the
    // one capture that has to be frictionless.
    ['todo', 'TODO', 'rationale', true],
    ['note', 'NOTE', 'rationale', true],
  ]);
});
