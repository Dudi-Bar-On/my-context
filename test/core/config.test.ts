import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, extraFieldNames, DEFAULT_BUDGETS } from '../../src/core/config.ts';
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
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', observations: [], relations: [],
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

test('extraFields in config is refused by name, and says where extra fields come from', () => {
  assert.throws(
    () => resolveConfig({ categories: { rule: { extraFields: ['owner'] } } }),
    /extraFields is not settable in config/,
  );
});

/** Everything the config DOES understand still loads — the refusal is about
 * keys this loop cannot act on, not about overriding. */
test('every documented category key is still accepted together', () => {
  const cfg = resolveConfig({
    categories: {
      rule: {
        enabled: false, tier: 'rationale', description: 'D', prefix: 'RL',
        agentEdits: 'review', scopePolicy: 'inert',
      },
    },
  });
  assert.deepEqual(
    {
      enabled: cfg.categories.rule.enabled, tier: cfg.categories.rule.tier,
      description: cfg.categories.rule.description, prefix: cfg.categories.rule.prefix,
      agentEdits: cfg.categories.rule.agentEdits, scopePolicy: cfg.categories.rule.scopePolicy,
    },
    {
      enabled: false, tier: 'rationale', description: 'D', prefix: 'RL',
      agentEdits: 'review', scopePolicy: 'inert',
    },
  );
});
