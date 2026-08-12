import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, DEFAULT_BUDGETS } from '../../src/core/config.ts';

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
