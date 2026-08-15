import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, DEFAULT_BUDGETS } from '../../src/core/config.ts';
import { isEligible } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

test('an empty config yields the standard profile', () => {
  const cfg = resolveConfig({});
  assert.equal(cfg.profile, 'standard');
  assert.equal(cfg.categories.constraint.enabled, true);
  assert.equal(cfg.categories.policy.enabled, false);
  assert.deepEqual(cfg.budgets, DEFAULT_BUDGETS);
});

test('the full profile enables everything', () => {
  const cfg = resolveConfig({ profile: 'full' });
  assert.equal(cfg.categories.taxonomy.enabled, true);
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
      policy: { enabled: true, description: 'House policy' },
      lesson: { agentEdits: 'review' },
    },
  });
  assert.equal(c.categories.policy.enabled, true);
  assert.equal(c.categories.policy.description, 'House policy');
  assert.equal(c.categories.policy.agentEdits, 'review');
  assert.equal(c.categories.lesson.enabled, true);
  assert.equal(c.categories.lesson.tier, 'rationale');
  assert.equal(c.categories.lesson.agentEdits, 'review');
  assert.equal(c.categories.lesson.scopePolicy, 'global');
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
