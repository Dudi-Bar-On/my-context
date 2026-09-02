import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveConfig, extraFieldNames, skippedKeyNotice, DEFAULT_BUDGETS, DEFAULT_UI,
} from '../../src/core/config.ts';
import { CATEGORIES } from '../../src/core/categories.ts';
import { isEligible } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

test('an empty config yields the standard profile', () => {
  const cfg = resolveConfig({});
  assert.equal(cfg.profile, 'standard');
  assert.equal(cfg.categories.constraint.enabled, true);
  // Every category, since Phase 3 removed the three that shipped disabled.
  assert.deepEqual(Object.values(cfg.categories).filter((c) => !c.enabled), []);
  assert.deepEqual(cfg.budgets, DEFAULT_BUDGETS);
});

/**
 * The `full` profile was removed, and a `config.json` that still names it is
 * the one refusal a working project walks into without editing anything. It
 * must be a refusal and not a fallback: resolving it silently to `standard`
 * would be a setting accepted and ignored, which
 * INV-nothing-is-dropped-silently rules out, in the one key that decides what
 * a corpus can hold.
 *
 * All three halves are asserted — that it throws, that the message names the
 * valid set rather than only saying "unknown", and that it says what to write
 * instead. A refusal a user cannot act on sends them to the source.
 */
test('a config that still says "full" is refused, and told what to write instead', () => {
  assert.throws(() => resolveConfig({ profile: 'full' }), (err: Error) => {
    assert.match(err.message, /unknown profile "full"/);
    assert.match(err.message, /Expected one of: minimal, standard\./,
      'the refusal must name the valid set, not merely reject the invalid one');
    assert.match(err.message, /Use "standard"/,
      'a user whose config was valid yesterday needs the replacement, not only the "no"');
    return true;
  });
});

/**
 * `PROFILES` is a plain object literal, so `"constructor" in PROFILES` is
 * true and the membership test used to admit it — `PROFILES["constructor"]`
 * is then `Object` itself, and `new Set(Object)` yields an empty enabled set:
 * a config naming a profile that does not exist, accepted, producing a corpus
 * in which every category is disabled and nothing says why.
 */
test('a profile named after an Object.prototype member is refused like any other', () => {
  for (const name of ['constructor', 'toString', '__proto__']) {
    assert.throws(() => resolveConfig({ profile: name }), /unknown profile/i, name);
  }
});

test('the minimal profile enables only its eight', () => {
  const cfg = resolveConfig({ profile: 'minimal' });
  assert.equal(Object.values(cfg.categories).filter((c) => c.enabled).length, 8);
  assert.equal(cfg.categories.runbook.enabled, false);
});

test('an explicit category override beats the profile', () => {
  const cfg = resolveConfig({ categories: { constraint: { enabled: false } } });
  assert.equal(cfg.categories.constraint.enabled, false);
});

test('a project can override a category tier', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  assert.equal(cfg.categories.edge_case.tier, 'normative');
});

test('a custom category is accepted when it declares tier and description', () => {
  const cfg = resolveConfig({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  assert.equal(cfg.categories.sla.tier, 'normative');
  assert.equal(cfg.categories.sla.prefix, 'SLA');
});

test('a custom category without a tier is rejected loudly', () => {
  assert.throws(
    () => resolveConfig({ categories: { sla: { enabled: true, description: 'x' } } }),
    /unknown category "sla".*tier.*description/is,
  );
});

/**
 * The default budgets, pinned as values rather than as an object identity.
 *
 * They are a product decision, not an implementation detail: every user of
 * this plugin gets these numbers, both READMEs print them in a table, and the
 * `budgets` section states what the raise bought and what it costs. Lowering
 * one back — the tempting fix for a session that feels heavy — has to fail
 * here and be argued, because the failure mode of a budget that is too small
 * is silent: the item is not missing, it is a name in an omission note.
 *
 * The floor beside each value is the measurement it was chosen against, on
 * this repository's own corpus: 4,478 estimated tokens of items matching
 * `src/cli/**` for `jit`, 504 across nineteen index lines for `index`, 1,072
 * across seven pinned items for `pinned`. The `jit` figure is the one that
 * moved during the change — annotating two scheduled requirements with their
 * decisions grew them past a first choice of 4,000, which is the concrete
 * reason the floor is asserted here rather than trusted.
 */
test('the default budgets are the raised ones, and clear what they were measured against', () => {
  assert.deepEqual(DEFAULT_BUDGETS, {
    pinned: 6000, jit: 6000, restored: 8000, continuity: 2000, index: 1200,
  });
  assert.ok(DEFAULT_BUDGETS.jit >= 4478,
    'jit no longer covers this repository\'s own src/cli/** selection');
  assert.ok(DEFAULT_BUDGETS.index >= 504, 'index no longer names every governing item here');
  // `continuity` is bounded from BOTH sides, unlike the other four, because
  // both directions are failures the tier exists to prevent. Too small and the
  // pointer plus digest it is supposed to carry cannot fit; too large and it
  // quietly becomes the document dump the ruling refused, which is the
  // 37,831-token handover arriving by another route.
  assert.ok(DEFAULT_BUDGETS.continuity >= 1000,
    'continuity can no longer hold a pointer plus a state digest');
  assert.ok(DEFAULT_BUDGETS.continuity <= 4000,
    'continuity is now large enough to swallow a document, the failure it prevents');
  assert.ok(DEFAULT_BUDGETS.pinned >= 1072, 'pinned no longer covers this repository\'s own');
});

test('a config written before continuity existed still loads, with the default in force', () => {
  // `requireBudgets` refuses an unknown key BY NAME, so the fifth budget could
  // only be added safely because its accepted key set is DERIVED from
  // `DEFAULT_BUDGETS`. Both directions are asserted: the four-key config every
  // existing installation has, and a config that names the new key explicitly.
  const four = resolveConfig({ budgets: { pinned: 900, jit: 800, restored: 700, index: 600 } });
  assert.equal(four.budgets.pinned, 900);
  assert.equal(four.budgets.continuity, DEFAULT_BUDGETS.continuity);

  const five = resolveConfig({ budgets: { continuity: 1234 } });
  assert.equal(five.budgets.continuity, 1234);
  assert.equal(five.budgets.pinned, DEFAULT_BUDGETS.pinned);
});

test('budgets merge partially', () => {
  const cfg = resolveConfig({ budgets: { pinned: 900 } });
  assert.equal(cfg.budgets.pinned, 900);
  assert.equal(cfg.budgets.index, DEFAULT_BUDGETS.index);
});

test('an unknown profile is rejected', () => {
  assert.throws(() => resolveConfig({ profile: 'enormous' }), /unknown profile/i);
});

test('a downstream mutation of extraFields does not affect a second resolved config', () => {
  const cfg1 = resolveConfig({});
  const cfg2 = resolveConfig({});
  const original1 = cfg1.categories.rule.extraFields.slice();
  cfg1.categories.rule.extraFields.push('mutated');
  assert.deepEqual(cfg2.categories.rule.extraFields, original1);
});

test('a downstream mutation of watchedDocs does not affect a second resolved config', () => {
  const cfg1 = resolveConfig({});
  const cfg2 = resolveConfig({});
  const original2 = cfg2.watchedDocs.slice();
  cfg1.watchedDocs.push('mutated');
  assert.deepEqual(cfg2.watchedDocs, original2);
});

test('an invalid tier on a built-in category override throws', () => {
  assert.throws(
    () => resolveConfig({ categories: { edge_case: { tier: 'sometimes' } } }),
    /category "edge_case" has invalid tier/i,
  );
});

test('a non-boolean enabled throws', () => {
  assert.throws(
    () => resolveConfig({ categories: { constraint: { enabled: 'false' } } }),
    /category "constraint" has invalid enabled/i,
  );
});

test('a non-string description throws', () => {
  assert.throws(
    () => resolveConfig({ categories: { constraint: { description: 123 } } }),
    /category "constraint" has invalid description/i,
  );
});

// --- agentEdits and scopePolicy ---------------------------------------------

test('agentEdits defaults by tier and scopePolicy defaults to global', () => {
  const c = resolveConfig({});
  assert.equal(c.categories.rule.agentEdits, 'review');
  assert.equal(c.categories.lesson.agentEdits, 'allow');
  for (const cat of Object.values(c.categories)) assert.equal(cat.scopePolicy, 'global');
});

// Every default here is derived from the *resolved* tier. A category the user
// retiers must take the new tier's default, not the catalogue's — otherwise a
// `lesson` promoted to the normative tier would keep letting agents rewrite
// what the agent is told to do, which is the whole reason the default splits
// by tier (spec §2).
test('a retiered category takes the new tier default, not the catalogue one', () => {
  const c = resolveConfig({ categories: { lesson: { tier: 'normative' } } });
  assert.equal(c.categories.lesson.agentEdits, 'review');
});

test('a retiered normative category takes the rationale default', () => {
  const c = resolveConfig({ categories: { rule: { tier: 'rationale' } } });
  assert.equal(c.categories.rule.agentEdits, 'allow');
});

test('an explicit setting beats the tier default', () => {
  const c = resolveConfig({ categories: { rule: { agentEdits: 'allow' } } });
  assert.equal(c.categories.rule.agentEdits, 'allow');
});

test('an explicit setting beats the tier default even when the tier is retiered too', () => {
  const c = resolveConfig({
    categories: { lesson: { tier: 'normative', agentEdits: 'allow' } },
  });
  assert.equal(c.categories.lesson.tier, 'normative');
  assert.equal(c.categories.lesson.agentEdits, 'allow');
});

test('a custom category takes its declared tier defaults', () => {
  const c = resolveConfig({
    categories: {
      sla: { tier: 'normative', description: 'Latency target' },
      note: { tier: 'rationale', description: 'A note' },
    },
  });
  assert.equal(c.categories.sla.agentEdits, 'review');
  assert.equal(c.categories.sla.scopePolicy, 'global');
  assert.equal(c.categories.note.agentEdits, 'allow');
  assert.equal(c.categories.note.scopePolicy, 'global');
});

test('a custom category can set both new keys explicitly', () => {
  const c = resolveConfig({
    categories: {
      sla: { tier: 'normative', description: 'x', agentEdits: 'allow', scopePolicy: 'required' },
    },
  });
  assert.equal(c.categories.sla.agentEdits, 'allow');
  assert.equal(c.categories.sla.scopePolicy, 'required');
});

// `categories` merges per key while `watchedDocs` replaces — documented
// because it surprises people. Two more keys must not change that: setting
// one key on one category must leave the other key on that same category, and
// every key on every other category, at its default.
test('setting one category does not reset another', () => {
  const c = resolveConfig({
    categories: { rule: { agentEdits: 'allow' }, pattern: { scopePolicy: 'required' } },
  });
  assert.equal(c.categories.rule.scopePolicy, 'global');
  assert.equal(c.categories.pattern.agentEdits, 'review');
  assert.equal(c.categories.constraint.enabled, true);
});

test('setting a new key does not reset enabled, tier or description on the same category', () => {
  const c = resolveConfig({
    categories: {
      standard: { enabled: false, description: 'House conventions' },
      lesson: { agentEdits: 'review' },
    },
  });
  assert.equal(c.categories.standard.enabled, false);
  assert.equal(c.categories.standard.description, 'House conventions');
  assert.equal(c.categories.standard.agentEdits, 'review');
  assert.equal(c.categories.lesson.enabled, true);
  assert.equal(c.categories.lesson.tier, 'rationale');
  assert.equal(c.categories.lesson.agentEdits, 'review');
  assert.equal(c.categories.lesson.scopePolicy, 'global');
});

// The two new keys are independent: setting either on a category must not
// disturb the other. Both explicit and both non-default, so a mutant that
// re-derives one while applying the other cannot hide behind a default that
// happens to agree.
test('the two new keys on one category do not overwrite each other', () => {
  const c = resolveConfig({ categories: { rule: { agentEdits: 'allow', scopePolicy: 'inert' } } });
  assert.equal(c.categories.rule.agentEdits, 'allow');
  assert.equal(c.categories.rule.scopePolicy, 'inert');
  const d = resolveConfig({
    categories: { lesson: { tier: 'normative', agentEdits: 'allow', scopePolicy: 'required' } },
  });
  assert.equal(d.categories.lesson.agentEdits, 'allow');
  assert.equal(d.categories.lesson.scopePolicy, 'required');
});

test('an invalid value is refused, naming the key and the valid set', () => {
  assert.throws(() => resolveConfig({ categories: { rule: { agentEdits: 'maybe' } } }),
    /agentEdits.*allow.*review/s);
  assert.throws(() => resolveConfig({ categories: { rule: { scopePolicy: 'everywhere' } } }),
    /scopePolicy.*global.*required.*inert/s);
});

test('an invalid value on a custom category is refused the same way', () => {
  assert.throws(
    () => resolveConfig({ categories: { sla: { tier: 'normative', description: 'x', agentEdits: 'maybe' } } }),
    /agentEdits.*allow.*review/s,
  );
  assert.throws(
    () => resolveConfig({ categories: { sla: { tier: 'normative', description: 'x', scopePolicy: 'nowhere' } } }),
    /scopePolicy.*global.*required.*inert/s,
  );
});

// The refusal has to say which category it is about — a user with twenty
// categories otherwise learns only that one of them is wrong. `enumError` is
// the shared vocabulary; the category travels in the field name so there is
// still exactly one wording for "not one of the allowed values".
test('the refusal names the category and points at help', () => {
  assert.throws(() => resolveConfig({ categories: { rule: { agentEdits: 'maybe' } } }), (err: Error) => {
    assert.match(err.message, /^my_context: /);
    assert.match(err.message, /rule/);
    assert.match(err.message, /mycontext_help/);
    return true;
  });
});

// A refusal must refuse — the value must never reach the resolved config,
// which is what "nothing is dropped silently" means for a bad enum.
test('a bad new-key value is not silently coerced to the default', () => {
  for (const bad of [null, 42, {}, ['allow'], '', 'Allow', 'ALLOW']) {
    assert.throws(
      () => resolveConfig({ categories: { rule: { agentEdits: bad } } }),
      /agentEdits/,
      `agentEdits ${JSON.stringify(bad)} should be refused`,
    );
    assert.throws(
      () => resolveConfig({ categories: { rule: { scopePolicy: bad } } }),
      /scopePolicy/,
      `scopePolicy ${JSON.stringify(bad)} should be refused`,
    );
  }
});

test('an invalid tier on a custom category throws', () => {
  assert.throws(
    () => resolveConfig({ categories: { sla: { tier: 'maybe', description: 'x' } } }),
    /custom category "sla" has invalid tier/i,
  );
});

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

// The user-visible half of the prototype bug: a category named after an
// `Object.prototype` key was accepted by resolveConfig, never gained an own
// key, and so behaved as if it had never been declared — a silent config drop.
test('a custom category named after an Object.prototype key works end to end', () => {
  const cfg = resolveConfig({
    categories: {
      constructor: { enabled: true, tier: 'normative', description: 'Build rules' },
    },
  });
  assert.ok(Object.hasOwn(cfg.categories, 'constructor'));
  assert.deepEqual(cfg.categories.constructor, {
    name: 'constructor',
    prefix: 'CONSTR',
    tier: 'normative',
    enabled: true,
    description: 'Build rules',
    extraFields: [],
    agentEdits: 'review',
    scopePolicy: 'global',
    // A custom category has no catalogue entry to inherit an `updates`
    // declaration from, and this one declares none of its own, so it resolves
    // to the empty declaration — which says "this category adds nothing of its
    // own" and is not a gap. What a custom category CAN now declare is in
    // `config-updates.test.ts`; the whole object is asserted here so that any
    // further key added to a resolved category has to arrive through a test.
    updates: {},
  });
  // It has to be visible to every consumer that enumerates or looks up
  // categories, not merely present on the object.
  assert.ok(Object.keys(cfg.categories).includes('constructor'));
  assert.equal(isEligible(item({ type: 'constructor' }), cfg), true);
});

test('a category override never writes through to Object.prototype', () => {
  const before = Object.getOwnPropertyDescriptor(Object, 'enabled');
  resolveConfig({ categories: { constructor: { enabled: false, tier: 'rationale', description: 'x' } } });
  assert.deepEqual(Object.getOwnPropertyDescriptor(Object, 'enabled'), before);
  assert.equal((Object.prototype as Record<string, unknown>).constructor, Object);
  assert.equal((Object as unknown as Record<string, unknown>).tier, undefined);
});

// The guarantee the bare `config.categories[item.type]` lookups in select.ts
// and decay.ts rely on. Pinned here rather than restated as a guard at each
// call site: this is the single place the map is built.
test('the resolved category map has no prototype', () => {
  assert.equal(Object.getPrototypeOf(resolveConfig({}).categories), null);
  assert.equal(resolveConfig({}).categories.constructor, undefined);
  assert.equal((resolveConfig({}).categories as Record<string, unknown>).toString, undefined);
});

test('an item typed after a polluted Object.prototype key stays ineligible', () => {
  const proto = Object.prototype as unknown as Record<string, unknown>;
  proto.polluted = { name: 'polluted', enabled: true, tier: 'normative' };
  try {
    const cfg = resolveConfig({});
    assert.equal(isEligible(item({ type: 'polluted' }), cfg), false);
  } finally {
    delete proto.polluted;
  }
});

/**
 * 1C.6 — every test above this point that touches `extraFields` calls
 * `resolveConfig({})`, so a mutant that CLEARS `extraFields` inside the
 * override branch changed nothing any of them could see and passed the whole
 * suite. The override branch is the branch that has to be exercised.
 */
test('overriding a built-in category keeps its extraFields', () => {
  for (const override of [
    { enabled: true },
    { enabled: false },
    { tier: 'rationale' },
    { description: 'Rewritten' },
    { agentEdits: 'allow' },
    { scopePolicy: 'inert' },
    { prefix: 'POLICY' },
  ]) {
    const cfg = resolveConfig({ categories: { rule: override } });
    assert.deepEqual(
      cfg.categories.rule.extraFields, ['directive'],
      `overriding rule with ${JSON.stringify(override)} dropped its extraFields`,
    );
  }
  // And the schema built from the union — the surface that actually goes to
  // an agent — still advertises it.
  assert.ok(
    extraFieldNames(resolveConfig({ categories: { rule: { enabled: false } } }))
      .includes('directive'),
  );
});

/** The same, for a category that declares more than one. */
test('overriding a category with several extraFields keeps all of them', () => {
  const cfg = resolveConfig({ categories: { risk: { scopePolicy: 'inert' } } });
  assert.deepEqual(cfg.categories.risk.extraFields, ['likelihood', 'impact']);
});

/**
 * `prefix` was declared on the raw shape, honoured when DEFINING a custom
 * category and never read when OVERRIDING a built-in one — accepted whole,
 * and every new rule still minted as `RULE-…`.
 */
test('prefix on a built-in category override is honoured, not dropped', () => {
  const cfg = resolveConfig({ categories: { rule: { prefix: 'POLICY' } } });
  assert.equal(cfg.categories.rule.prefix, 'POLICY');
  // Nothing else on the category moved with it.
  assert.equal(cfg.categories.rule.tier, 'normative');
  assert.equal(cfg.categories.rule.enabled, true);
  assert.deepEqual(cfg.categories.rule.extraFields, ['directive']);
});

test('prefix on a custom category is still honoured', () => {
  const cfg = resolveConfig({
    categories: { runbook: { tier: 'normative', description: 'How to', prefix: 'RUN' } },
  });
  assert.equal(cfg.categories.runbook.prefix, 'RUN');
});

/** An id is `PREFIX-slug` and is also the item's file name, so the prefix is
 * validated on BOTH branches rather than trusted on either. */
test('an unusable prefix is refused on a built-in and on a custom category alike', () => {
  for (const bad of ['', 'a/b', 'HAS-HYPHEN', 'has space', 'WAY-TOO-LONG-FOR-AN-ID', 12, null]) {
    assert.throws(
      () => resolveConfig({ categories: { rule: { prefix: bad } } }),
      /invalid prefix/,
      `built-in accepted prefix ${JSON.stringify(bad)}`,
    );
    assert.throws(
      () => resolveConfig({
        categories: { runbook: { tier: 'normative', description: 'How to', prefix: bad } },
      }),
      /invalid prefix/,
      `custom accepted prefix ${JSON.stringify(bad)}`,
    );
  }
});

/**
 * The latent second half of 1C.6: a category entry key nobody reads was
 * accepted and dropped in silence. `extraFields` is the one a user actually
 * writes — the category table shows `rule` declaring `directive`, so declaring
 * one of your own is the obvious next thought — and it used to mint a category
 * carrying the catalogue's fields under a config that said otherwise.
 */
test('an unknown key on a category entry is refused, not ignored', () => {
  assert.throws(
    () => resolveConfig({ categories: { rule: { enabled: true, sevrity: 'hard' } } }),
    /"sevrity".*not a key this config understands/s,
  );
  // The refusal reaches a custom category too, before the tier/description
  // checks that branch already had.
  assert.throws(
    () => resolveConfig({
      categories: { runbook: { tier: 'normative', description: 'How to', steps: 3 } },
    }),
    /"steps"/,
  );
});

/**
 * `extraFields` used to be refused BY NAME, and the reason it gave was true
 * when it was written: nothing validated an extra field against the item's own
 * category, so a field declared here would have been advertised to every agent
 * through the union `create_item` schema and accepted on every category. That
 * hole is closed in the same commit as these tests — `unknownExtraFieldError`
 * (core/trust.ts) refuses a key the item's category does not declare — so the
 * reason is answered and the key is settable.
 *
 * Both halves had to land together: 250 would-be violations existed in this
 * machine's outer corpus and every one of them was a `task` item, a CUSTOM
 * category, which before this could declare nothing at all. Validation shipped
 * alone would have refused exactly the items the feature was built for.
 *
 * `task` has since been ADOPTED into the catalogue (2026-09-02), so the
 * fixtures below name `chore` instead: a shipped category takes the built-in
 * branch of `resolveConfig`, where `extraFields` EXTENDS the catalogue's list,
 * and these two tests are about the branch where the config's list is the whole
 * of it. The built-in branch is pinned in `config-task-override.test.ts`.
 */
test('extraFields is a settable category key on a custom category', () => {
  const cfg = resolveConfig({
    categories: {
      chore: {
        tier: 'rationale',
        description: 'A unit of planned work',
        extraFields: ['plan', 'seq', 'state', 'progress', 'source'],
      },
    },
  });
  assert.deepEqual(cfg.categories.chore.extraFields, ['plan', 'seq', 'state', 'progress', 'source']);
  // And it reaches the union the MCP schema is built from.
  assert.ok(extraFieldNames(cfg).includes('progress'));
});

test('a custom category with no extraFields entry still declares none', () => {
  const cfg = resolveConfig({
    categories: { chore: { tier: 'rationale', description: 'A unit of planned work' } },
  });
  assert.deepEqual(cfg.categories.chore.extraFields, []);
});

/**
 * EXTEND, not replace — the one list key on the built-in branch that does not
 * behave like `watchedDocs`. The catalogue field is the assertion that matters:
 * replace would satisfy a test that only checked the new field, and would then
 * drop `directive` from every `rule` — which the validation added in this same
 * commit would turn into a refusal of every existing rule item that carries it.
 */
test('extraFields on a built-in category EXTENDS the catalogue, it does not replace it', () => {
  const cfg = resolveConfig({ categories: { rule: { extraFields: ['owner'] } } });
  assert.deepEqual(cfg.categories.rule.extraFields, ['directive', 'owner']);
  assert.deepEqual(
    resolveConfig({ categories: { risk: { extraFields: ['owner'] } } }).categories.risk.extraFields,
    ['likelihood', 'impact', 'owner'],
  );
});

/** A catalogue field cannot be removed from config, and omitting it is an
 * addition rather than a removal request — `[]` adds nothing and takes nothing
 * away. `directive` is part of what `rule` MEANS, not a preference. */
test('extraFields cannot remove a catalogue field', () => {
  assert.deepEqual(resolveConfig({ categories: { rule: { extraFields: [] } } }).categories.rule.extraFields,
    ['directive']);
  assert.deepEqual(
    resolveConfig({ categories: { rule: { extraFields: ['owner'] } } }).categories.rule.extraFields
      .includes('directive'), true);
});

/** Listing a catalogue field explicitly is legal and collapses rather than
 * appearing twice — the list is rendered verbatim in refusals and in the
 * ingest extraction request, where a repeat reads as a product bug. */
test('a catalogue field listed again in config does not appear twice', () => {
  assert.deepEqual(
    resolveConfig({ categories: { rule: { extraFields: ['directive', 'owner'] } } })
      .categories.rule.extraFields,
    ['directive', 'owner'],
  );
});

test('extraFields must be an array of strings, refused rather than coerced', () => {
  for (const bad of ['owner', 42, null, {}, ['ok', 7], [null]]) {
    assert.throws(
      () => resolveConfig({ categories: { rule: { extraFields: bad } } }),
      /has invalid extraFields/,
      `accepted extraFields ${JSON.stringify(bad)}`,
    );
  }
});

/**
 * The key grammar is `validateExtra`'s (core/validate.ts) — CALLED, not
 * restated — so a field declared here is always a field an item could actually
 * carry. A name the frontmatter grammar cannot reparse, a reserved frontmatter
 * name, and `__proto__` are each refused at config load rather than at the
 * first capture that tries to use them.
 */
test('an extraFields entry that could never be a frontmatter key is refused at load', () => {
  for (const bad of ['valid-until', '9lives', 'has space', 'status', 'id', '__proto__', '']) {
    assert.throws(
      () => resolveConfig({ categories: { rule: { extraFields: [bad] } } }),
      /cannot be a frontmatter key/,
      `accepted extraFields entry ${JSON.stringify(bad)}`,
    );
  }
  // And the reused sentence carries the actual rule, not just "no".
  assert.throws(
    () => resolveConfig({ categories: { rule: { extraFields: ['status'] } } }),
    /collides with a reserved frontmatter field/,
  );
});

/** Everything the config DOES understand still loads — the refusal is about
 * keys this loop cannot act on, not about overriding. */
test('every documented category key is still accepted together', () => {
  const cfg = resolveConfig({
    categories: {
      rule: {
        enabled: false, tier: 'rationale', description: 'D', prefix: 'RL',
        agentEdits: 'review', scopePolicy: 'inert', extraFields: ['owner'],
        updates: { owner: { store: 'field', note: 'Who owns it.' } },
      },
    },
  });
  assert.deepEqual(
    {
      enabled: cfg.categories.rule.enabled, tier: cfg.categories.rule.tier,
      description: cfg.categories.rule.description, prefix: cfg.categories.rule.prefix,
      agentEdits: cfg.categories.rule.agentEdits, scopePolicy: cfg.categories.rule.scopePolicy,
      extraFields: cfg.categories.rule.extraFields,
      // Both list keys EXTEND on this branch — the catalogue's `directive` is
      // still declared, and still described. `config-updates.test.ts` holds the
      // rest of the merge.
      updates: cfg.categories.rule.updates,
    },
    {
      enabled: false, tier: 'rationale', description: 'D', prefix: 'RL',
      agentEdits: 'review', scopePolicy: 'inert', extraFields: ['directive', 'owner'],
      updates: {
        directive: CATEGORIES.rule.updates.directive,
        owner: { store: 'field', note: 'Who owns it.' },
      },
    },
  );
});

/**
 * The `budgets` sibling of 1C.6 and B3.6, and the worst of the family:
 * budgets decide what reaches a session at all, so a typo'd budget key or an
 * invalid value silently keeping the default means the user thinks they
 * raised a limit and they did not — the only symptom is items quietly missing
 * from their context (INV-nothing-is-dropped-silently).
 */
test('an unknown budget key is refused by name, with the valid set', () => {
  assert.throws(
    () => resolveConfig({ budgets: { pined: 9000 } }),
    /"pined".*not a budget this config understands.*pinned, jit, restored, continuity, index/s,
  );
});

test('an invalid budget value is refused, naming the key and the value', () => {
  assert.throws(() => resolveConfig({ budgets: { pinned: '6000' } }), /budgets\.pinned is "6000"/);
  assert.throws(() => resolveConfig({ budgets: { jit: -1 } }), /budgets\.jit is -1/);
  assert.throws(() => resolveConfig({ budgets: { index: null } }), /budgets\.index is null/);
  assert.throws(
    () => resolveConfig({ budgets: { restored: Number.POSITIVE_INFINITY } }),
    /budgets\.restored/,
  );
});

test('a non-object budgets section is refused, not defaulted', () => {
  assert.throws(() => resolveConfig({ budgets: 9000 }), /"budgets" is 9000, not an object/);
});

test('watchedDocs refuses a non-array and a non-string entry, not filters them', () => {
  // A bare glob string used to be silently REPLACED with the default list —
  // the user's setting inverted, not merely dropped.
  assert.throws(
    () => resolveConfig({ watchedDocs: 'docs/prd/**' }),
    /"watchedDocs" is "docs\/prd\/\*\*", not an array/,
  );
  assert.throws(
    () => resolveConfig({ watchedDocs: ['docs/prd/**', 42] }),
    /watchedDocs contains 42/,
  );
});

/**
 * THIS TEST MOVED, and the move is the behaviour change — R14.2. It used to
 * assert that `{"budget": ...}` throws and that NOTHING was loaded. It now
 * asserts the opposite verdict for the same input, and the reason is not that
 * the old refusal was wrong about `"budget"`: a misspelled budgets key really
 * does leave every limit at its default, and the user really does need to hear
 * about it.
 *
 * What the refusal was wrong about is the OTHER thing a top-level key can be.
 * A new feature arrives as a new top-level key, so a config carrying one this
 * build has never heard of may simply have been written for a newer build.
 * Refusing the whole file for that disables the entire plugin on a config that
 * is perfectly correct — which is what would have happened to every user who
 * had not upgraded on the day `ui` shipped, and to every top-level key after
 * it. The old test pinned a contract that made new keys unshippable.
 *
 * The typo case keeps everything it had except the severity: the key is still
 * named, the valid set is still printed, and the user still learns the setting
 * they wrote is not in force — from `skippedKeyNotice`, not from a dead
 * plugin. What is NOT allowed to move is the skip going unsaid; that is the
 * next test, and INV-nothing-is-dropped-silently is why it exists.
 */
test('an unknown top-level key is skipped, and the rest of the config still loads', () => {
  const cfg = resolveConfig({ budget: { pinned: 9000 } });
  assert.deepEqual(cfg.skippedKeys, ['budget']);
  // The old refusal's whole point, still true and still the user's problem:
  // the limit they wrote is not in force.
  assert.equal(cfg.budgets.pinned, DEFAULT_BUDGETS.pinned);
  // ...and the plugin is not dead, which is the half that changed.
  assert.equal(cfg.profile, 'standard');
  assert.equal(cfg.categories.constraint.enabled, true);

  const cfg2 = resolveConfig({ profile: 'standard', watched_docs: [] });
  assert.deepEqual(cfg2.skippedKeys, ['watched_docs']);
});

/**
 * The skip is only survivable because it SPEAKS. A key accepted and dropped
 * without a word is the exact failure `TOP_LEVEL_KEYS` was added to end, so
 * every part of the sentence is pinned: the key by name, the verb, the valid
 * set, and both readings — because `resolveConfig` cannot tell a typo from a
 * config written for a newer build, and asserting either one would be wrong
 * half the time.
 */
test('the skip is disclosed by name, with the valid set and both readings', () => {
  const notice = skippedKeyNotice(resolveConfig({ budget: { pinned: 9000 } }));
  assert.match(notice, /"budget"/, 'the notice must name the key');
  assert.match(notice, /skipped/, 'the notice must say what happened to it');
  assert.match(notice, /profile, categories, budgets, watchedDocs, ui/,
    'the notice must name the valid set, not merely reject the invalid key');
  assert.match(notice, /misspelled/, 'the typo reading, which is the user to fix');
  assert.match(notice, /newer my_context/, 'the version reading, which is not');
});

/** The silence has to be earned: a config this build fully understands must
 * produce no notice at all, or the channel becomes noise nobody reads. */
test('a config this build fully understands discloses nothing', () => {
  const cfg = resolveConfig({
    profile: 'minimal', budgets: { pinned: 900 }, watchedDocs: ['a/**'], ui: { enabled: false },
    categories: { rule: { enabled: false } },
  });
  assert.deepEqual(cfg.skippedKeys, []);
  assert.equal(skippedKeyNotice(cfg), '');
});

test('several unknown top-level keys are all named, in the order the file wrote them', () => {
  const cfg = resolveConfig({ zebra: 1, profile: 'minimal', apple: 2 });
  assert.deepEqual(cfg.skippedKeys, ['zebra', 'apple']);
  assert.equal(cfg.profile, 'minimal');
  assert.match(skippedKeyNotice(cfg), /"zebra", "apple".*are not keys/s);
});

/** A skipped key is skipped, not half-read: everything else resolves exactly
 * as it does without it. This is also the property the sibling command that
 * WRITES a key depends on — adding a key must not disturb the others. */
test('a skipped key changes nothing else about the resolved config', () => {
  const raw = { profile: 'minimal', budgets: { jit: 7 }, watchedDocs: ['a/**'] };
  const clean = resolveConfig(raw);
  const fromTheFuture = resolveConfig({ ...raw, packs: [{ name: 'ships-in-a-later-build' }] });
  assert.deepEqual(fromTheFuture.skippedKeys, ['packs']);
  assert.deepEqual({ ...fromTheFuture, skippedKeys: [] }, clean);
});

/**
 * `__proto__` survives `JSON.parse` as an own enumerable key, so it reaches
 * this filter like any other name. It used to be refused as an unknown
 * top-level key; now it is skipped, which means the skip must not be a way in.
 * Nothing reads it and nothing merges the input, so the assertion is that the
 * global prototype is untouched after the config loads.
 */
test('a __proto__ key at the top level is skipped like any other and pollutes nothing', () => {
  const raw: unknown = JSON.parse('{"__proto__": {"polluted": true}, "profile": "minimal"}');
  const cfg = resolveConfig(raw);
  assert.deepEqual(cfg.skippedKeys, ['__proto__']);
  assert.equal(cfg.profile, 'minimal');
  assert.equal((({} as Record<string, unknown>).polluted), undefined);
});

/**
 * WHERE THE BOUNDARY SITS. R14.2 moved the verdict at the top level and
 * nowhere else, and this is the test that says so in both directions. The
 * three nested checks live in three different places — `requireCategoryKeys`,
 * `requireBudgets` and `requireUi` — so "the boundary is one function" is not
 * a thing anyone can assume; what they share is that they guard the inside of
 * a KNOWN block, where nothing arrives from the future. A newer build extends
 * a block's own key list, and `"sevrity"`, `"pined"` and `"enabld"` have no
 * reading in which the user meant something this build could honour.
 *
 * The messages are asserted as they stand today, including `Nothing was
 * loaded`, because "still refuses" that quietly reworded itself would be a
 * second contract change hiding inside this one.
 */
test('an unknown key INSIDE a known block still refuses, with the message it has today', () => {
  assert.throws(
    () => resolveConfig({ categories: { rule: { enabled: true, sevrity: 'hard' } } }),
    /"sevrity".*is not a key this config understands.*Nothing was loaded/s,
  );
  assert.throws(
    () => resolveConfig({ budgets: { pined: 9000 } }),
    /"pined".*is not a budget this config understands.*Nothing was loaded/s,
  );
  assert.throws(
    () => resolveConfig({ ui: { enabld: false } }),
    /"enabld".*is not a key this config understands.*Nothing was loaded/s,
  );
});

/** The same name, two verdicts, decided only by depth — the boundary stated as
 * one input. */
test('one name is skipped at the top level and refused inside a block', () => {
  assert.deepEqual(resolveConfig({ sevrity: 'hard' }).skippedKeys, ['sevrity']);
  assert.throws(
    () => resolveConfig({ categories: { rule: { sevrity: 'hard' } } }),
    /"sevrity"/,
  );
});

test('a config that is not an object at all is refused; null and undefined mean defaults', () => {
  assert.throws(() => resolveConfig([]), /config is \[\], not an object/);
  assert.throws(() => resolveConfig('standard'), /config is "standard", not an object/);
  assert.deepEqual(resolveConfig(null).budgets, DEFAULT_BUDGETS);
  assert.deepEqual(resolveConfig(undefined).budgets, DEFAULT_BUDGETS);
});

test('a non-object categories section and a non-object category entry are refused', () => {
  assert.throws(() => resolveConfig({ categories: [] }), /"categories" is \[\], not an object/);
  assert.throws(
    () => resolveConfig({ categories: { rule: 'off' } }),
    /category "rule" is "off", not an object/,
  );
});

/** Everything valid still loads together — the refusals are about what cannot
 * be acted on, not about setting values. */
test('valid budgets and watchedDocs still load', () => {
  const cfg = resolveConfig({
    budgets: { pinned: 900, jit: 0 },
    watchedDocs: ['specs/**'],
  });
  assert.equal(cfg.budgets.pinned, 900);
  assert.equal(cfg.budgets.jit, 0);
  assert.equal(cfg.budgets.restored, DEFAULT_BUDGETS.restored);
  assert.deepEqual(cfg.watchedDocs, ['specs/**']);
});

/**
 * R14.3. The UI is opt-OUT, so the absent key is the ENABLED key, and the two
 * are not the same fact: absent means nobody has expressed an opinion and the
 * product's answer is yes; `false` means a user wrote the key and said no.
 * Conflating them is the bug this ruling is most likely to produce, and it has
 * exactly one spelling — `input.ui?.enabled ?? false`, `undefined` falling to
 * `false` — which would switch the web UI off for every workspace that has
 * never heard of the key, including every workspace that existed before it.
 *
 * `{"ui": {}}` is pinned alongside, because it is the second spelling of "no
 * opinion": the section declared and nothing said inside it is still not a no.
 */
test('the ui key absent means ENABLED — absence is not disabled', () => {
  const cfg = resolveConfig({});
  assert.deepEqual(cfg.ui, DEFAULT_UI);
  assert.equal(cfg.ui.enabled, true);
  assert.equal(resolveConfig({ ui: {} }).ui.enabled, true,
    'a declared but empty section is still nobody saying no');
  assert.equal(resolveConfig(null).ui.enabled, true, 'no config file at all is not a no');
  assert.equal(resolveConfig(undefined).ui.enabled, true);
});

test('ui present and false disables; present and true enables', () => {
  assert.equal(resolveConfig({ ui: { enabled: false } }).ui.enabled, false);
  assert.equal(resolveConfig({ ui: { enabled: true } }).ui.enabled, true);
});

/**
 * **This assertion's premise was overturned on 2026-08-27, deliberately, and the
 * old reasoning is kept because it is the better half of the new one.**
 *
 * It used to read: *"a port, a host or a handle here would be this key deciding
 * something about a running process, which it does not."* That was true, and it
 * was the reason `ui.enabled` sat validated and enforced by nothing for weeks —
 * the section described a permission nobody consulted.
 *
 * `REQ-the-ui-server-is-running-whenever-the-owner-looks-or-it-says` makes it
 * false on purpose. `ui.port` is exactly the port the old comment ruled out, and
 * it is here because a HOOK cannot use port 0: an ephemeral port is a URL nobody
 * can bookmark, and the whole point is a server that is there when its owner
 * looks.
 *
 * **The distinction survives, one level down, and it is what keeps the section
 * honest.** `enabled` says WHETHER and `port` says WHERE. Neither opens a socket
 * — resolving this section still listens to nothing and spawns nothing. What
 * changed is that something now READS them: `mycontext ui` refuses when
 * `enabled` is false, and the upkeep hook stays entirely off until `port` is
 * set. Absent means off, which is why a plugin that spawns a background server
 * because somebody installed it is not what shipped.
 *
 * `port` must be a PRESENT key with the value `null`, not an absent one. Under
 * `node:assert/strict` an absent field reads `undefined`, and "the user has not
 * chosen a port" would then be indistinguishable from "this build does not know
 * about ports" — `STD-absent-vs-zero` on the field that decides whether a
 * process starts.
 */
test('the resolved ui section is permission AND place, and place arrived 2026-08-27', () => {
  assert.deepEqual(Object.keys(resolveConfig({ ui: { enabled: true } }).ui), ['enabled', 'port']);
  assert.equal(typeof resolveConfig({}).ui.enabled, 'boolean');
  assert.equal(resolveConfig({}).ui.port, null,
    'an unset port is null and PRESENT — absent would read as a build that knows nothing of ports');
});

/** The point of adding the key to `TOP_LEVEL_KEYS` rather than relying on
 * R14.2 to skip it: a config that sets `ui` must be a config this build
 * UNDERSTANDS, not one it tolerates. */
test('ui is a key this build understands, so setting it discloses nothing', () => {
  assert.deepEqual(resolveConfig({ ui: { enabled: false } }).skippedKeys, []);
  assert.equal(skippedKeyNotice(resolveConfig({ ui: { enabled: false } })), '');
});

/** A sibling command will WRITE this key into an existing `config.json`, so
 * adding it must disturb nothing else that file already says. */
test('adding ui to an existing config changes nothing else in it', () => {
  const raw = {
    profile: 'minimal', budgets: { jit: 7 }, watchedDocs: ['a/**'],
    categories: { rule: { enabled: false, prefix: 'RL' } },
  };
  const before = resolveConfig(raw);
  const after = resolveConfig({ ...raw, ui: { enabled: false } });
  assert.equal(after.ui.enabled, false);
  assert.equal(before.ui.enabled, true);
  assert.deepEqual({ ...after, ui: before.ui }, before);
});

/**
 * A bare `"ui": false` is the shape this key deliberately did NOT take, and it
 * is refused rather than accepted as sugar: two spellings of one setting means
 * the command that writes the key must choose one and round-trip the other,
 * and a value that is sometimes a boolean is a value no second UI setting can
 * ever be added to. The refusal has to say what to write instead — a user who
 * wrote the obvious thing is not helped by "no".
 */
test('a non-object ui section is refused, not defaulted', () => {
  for (const bad of [false, true, [], 'off', 0, null]) {
    assert.throws(
      () => resolveConfig({ ui: bad }),
      /"ui" is .*, not an object/s,
      `ui accepted ${JSON.stringify(bad) ?? 'undefined'}`,
    );
  }
  assert.throws(() => resolveConfig({ ui: false }), /\{"ui": \{"enabled": false\}\}/,
    'the refusal must show the spelling that works');
});

/**
 * The one-way failure this section cannot have. Every non-boolean is truthy or
 * falsy by accident — `"false"` is truthy — so a lenient reading of
 * `{"ui": {"enabled": "false"}}` leaves the UI PERMITTED for a user who wrote
 * the key specifically to forbid it. A permission that fails towards
 * "permitted" in silence is not a permission, so the value is refused by name.
 */
test('a non-boolean ui.enabled is refused, naming the key and the value', () => {
  assert.throws(() => resolveConfig({ ui: { enabled: 'false' } }), /ui\.enabled is "false"/);
  assert.throws(() => resolveConfig({ ui: { enabled: 'true' } }), /ui\.enabled is "true"/);
  assert.throws(() => resolveConfig({ ui: { enabled: 0 } }), /ui\.enabled is 0/);
  assert.throws(() => resolveConfig({ ui: { enabled: null } }), /ui\.enabled is null/);
});

/**
 * The two rulings together, as the situation they were written for: a
 * `config.json` from a build that knows `ui` and something after it, read by
 * this build. It loads, `ui` is honoured because this build knows it, the
 * later key is skipped and disclosed, and the plugin does its whole job.
 */
test('a config written for a newer build loads, and the plugin keeps working', () => {
  const cfg = resolveConfig({
    profile: 'standard',
    ui: { enabled: false },
    packs: [{ name: 'ships-in-a-later-build' }],
  });
  assert.equal(cfg.profile, 'standard');
  assert.equal(cfg.ui.enabled, false);
  assert.equal(cfg.categories.constraint.enabled, true);
  assert.deepEqual(cfg.budgets, DEFAULT_BUDGETS);
  assert.deepEqual(cfg.skippedKeys, ['packs']);
  assert.match(skippedKeyNotice(cfg), /"packs"/);
});
