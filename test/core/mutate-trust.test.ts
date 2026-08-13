import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem, trustedStatus } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

test('trustedStatus forces agent-authored normative items to draft', () => {
  assert.equal(trustedStatus('agent', 'normative', 'active'), 'draft');
  assert.equal(trustedStatus('agent', 'normative', 'draft'), 'draft');
});

test('trustedStatus leaves every other combination alone', () => {
  assert.equal(trustedStatus('agent', 'rationale', 'active'), 'active');
  assert.equal(trustedStatus('human', 'normative', 'active'), 'active');
  assert.equal(trustedStatus('human', 'rationale', 'active'), 'active');
  assert.equal(trustedStatus('ingest', 'normative', 'draft'), 'draft');
});

test('an agent-authored constraint lands as draft', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'agent',
  });
  assert.equal(result.status, 'draft');
  assert.equal(s.ctx.store.get(result.id)?.status, 'draft');
  s.dispose();
});

test('an agent cannot request active for a normative item', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'rule', title: 'Never log secrets', origin: 'agent', status: 'active',
  });
  assert.equal(result.status, 'draft');
  s.dispose();
});

test('an agent-authored lesson stays active — rationale is never injected anyway', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'lesson', title: 'Migrations need an advisory lock', origin: 'agent',
  });
  assert.equal(result.status, 'active');
  s.dispose();
});

test('a human-authored constraint stays active', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'human',
  });
  assert.equal(result.status, 'active');
  s.dispose();
});

test('the default origin is human, so the CLI is unaffected', () => {
  const s = sandbox();
  const result = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  assert.equal(result.status, 'active');
  s.dispose();
});

test('a project tier override extends the rule to that category', () => {
  const s = sandbox({ categories: { edge_case: { tier: 'normative' } } });
  const promoted = createItem(s.ctx, {
    type: 'edge_case', title: 'Empty cart at checkout', origin: 'agent',
  });
  assert.equal(promoted.status, 'draft');
  s.dispose();
});

test('a custom normative category gets the rule too', () => {
  const s = sandbox({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  const result = createItem(s.ctx, {
    type: 'sla', title: 'Checkout responds within 300ms', origin: 'agent',
  });
  assert.equal(result.status, 'draft');
  s.dispose();
});

test('the draft message tells the caller what happens next', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'agent',
  });
  assert.match(result.message, /draft/);
  assert.match(result.message, /mycontext review/);
  s.dispose();
});
