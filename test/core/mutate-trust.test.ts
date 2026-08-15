import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem, trustedStatus, updateItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

test('trustedStatus forces agent-authored normative items to draft', () => {
  assert.equal(trustedStatus('agent', 'normative', 'active'), 'draft');
  assert.equal(trustedStatus('agent', 'normative', 'draft'), 'draft');
});

/**
 * Spec §7.1's rule is per-tier, not per-caller: ANY non-human origin on the
 * normative tier is demoted. `'ingest'` is a valid `Origin` (types.ts) that
 * was not covered before this ruling — this asserts `active` requested for
 * an ingested normative item to actually be forced to `draft`, not merely
 * passed a value that already happened to be `draft` (which would pass
 * whether or not the rule fired at all).
 */
test('trustedStatus forces ingest-authored normative items to draft too', () => {
  assert.equal(trustedStatus('ingest', 'normative', 'active'), 'draft');
  assert.equal(trustedStatus('ingest', 'normative', 'draft'), 'draft');
});

test('trustedStatus leaves every other combination alone', () => {
  assert.equal(trustedStatus('agent', 'rationale', 'active'), 'active');
  assert.equal(trustedStatus('human', 'normative', 'active'), 'active');
  assert.equal(trustedStatus('human', 'rationale', 'active'), 'active');
  assert.equal(trustedStatus('ingest', 'rationale', 'active'), 'active');
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

test('an ingested constraint lands as draft, not active', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'ingest',
  });
  assert.equal(result.status, 'draft');
  assert.equal(s.ctx.store.get(result.id)?.status, 'draft');
  s.dispose();
});

test('the ingest draft message explains the demotion, same as the agent path', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'ingest',
  });
  assert.match(result.message, /mycontext review/);
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
  assert.match(result.message, /mycontext review/);
  s.dispose();
});

test('an agent-authored rationale item explicitly drafted carries no demotion suffix', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'lesson', title: 'Locks are needed', origin: 'agent', status: 'draft',
  });
  assert.equal(result.status, 'draft');
  assert.doesNotMatch(result.message, /mycontext review/);
  assert.doesNotMatch(result.message, /not injected/);
  s.dispose();
});

/**
 * The injection-control fields. `scope`, `always` and `severity` decide
 * whether — and how forcefully — a governing item reaches a session, so an
 * agent changing one of them on a human's active constraint neutralises it
 * just as completely as the `status` change `updateItem` already refuses,
 * and does it invisibly: the item stays `active`, so it appears in no draft
 * queue, no retired count, and `select` records no spill because it was
 * never a candidate.
 */
test('an agent cannot empty the scope of a governing normative item', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', scope: ['src/db/**'],
  });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, scope: [], origin: 'agent' }),
    /cannot change the scope of a governing normative item/i,
  );
  assert.deepEqual(s.ctx.store.get(created.id)?.scope, ['src/db/**']);
  s.dispose();
});

/**
 * Widening R2: `guardedChange`'s refusal is gated on `origin === 'agent'`
 * in the code, but its rationale — the injection-control fields are a
 * human decision on a governing item — is not specific to agents. Ingested
 * content reaches this same tool, so it must be refused identically or an
 * ingestion pipeline could silently neutralise a human's active constraint
 * by clearing its scope.
 */
test('ingest cannot empty the scope of a governing normative item either', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', scope: ['src/db/**'],
  });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, scope: [], origin: 'ingest' }),
    /cannot change the scope of a governing normative item/i,
  );
  assert.deepEqual(s.ctx.store.get(created.id)?.scope, ['src/db/**']);
  s.dispose();
});

test('an agent cannot redirect a governing item\'s scope to a path that does not exist', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', scope: ['src/db/**'],
  });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, scope: ['does/not/exist/**'], origin: 'agent' }),
    /cannot change the scope of a governing normative item/i,
  );
  assert.deepEqual(s.ctx.store.get(created.id)?.scope, ['src/db/**']);
  s.dispose();
});

test('an agent cannot unpin a governing instruction by clearing always', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'instruction', title: 'Run the tests first', always: true,
  });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, always: false, origin: 'agent' }),
    /cannot change the always flag of a governing normative item/i,
  );
  assert.equal(s.ctx.store.get(created.id)?.always, true);
  s.dispose();
});

test('an agent cannot downgrade the severity of a governing normative item', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', severity: 'hard',
  });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, severity: 'soft', origin: 'agent' }),
    /cannot change the severity of a governing normative item/i,
  );
  assert.equal(s.ctx.store.get(created.id)?.severity, 'hard');
  s.dispose();
});

test('the refusal also covers a validated normative item', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', severity: 'hard' });
  updateItem(s.ctx, { id: created.id, status: 'validated' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, severity: 'soft', origin: 'agent' }),
    /cannot change the severity of a governing normative item/i,
  );
  s.dispose();
});

test('the refusal message names the field and says the decision is a human one', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, scope: [], origin: 'agent' }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /scope/);
      assert.match(err.message, /human decision/i);
      assert.match(err.message, /injected/);
      return true;
    },
  );
  s.dispose();
});

// The four things the guard must NOT break.

test('an agent may still edit its own draft freely, including scope and severity', () => {
  const s = sandbox();
  const draft = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'agent', scope: ['src/db/**'],
  });
  assert.equal(draft.status, 'draft');
  updateItem(s.ctx, { id: draft.id, scope: ['src/api/**'], origin: 'agent' });
  updateItem(s.ctx, { id: draft.id, severity: 'hard', origin: 'agent' });
  updateItem(s.ctx, { id: draft.id, always: true, origin: 'agent' });
  const after = s.ctx.store.get(draft.id)!;
  assert.deepEqual(after.scope, ['src/api/**']);
  assert.equal(after.severity, 'hard');
  assert.equal(after.always, true);
  s.dispose();
});

/**
 * `agentEdits: 'allow'` is explicit because this test is about the FIELD
 * guard's narrowness — that it refuses scope/always/severity and nothing
 * else — not about the staging policy. Under the normative default
 * (`review`), the same call is accepted and STAGED instead of applied, which
 * is a different rule with its own file (`test/core/agent-edits.test.ts`),
 * including the two tests that pin that neither policy moves this guard.
 */
test('an agent may still edit body, title and tags on a governing normative item', () => {
  const s = sandbox({ categories: { constraint: { agentEdits: 'allow' } } });
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  updateItem(s.ctx, {
    id: created.id, body: 'RDS permits 25.', title: 'Pool cap, restated',
    tags: ['database'], origin: 'agent',
  });
  const after = s.ctx.store.get(created.id)!;
  assert.equal(after.body, 'RDS permits 25.');
  assert.equal(after.title, 'Pool cap, restated');
  assert.deepEqual(after.tags, ['database']);
  s.dispose();
});

test('a rationale item is unaffected by this boundary — an agent may change its scope', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'lesson', title: 'Locks matter', scope: ['src/db/**'] });
  updateItem(s.ctx, { id: created.id, scope: [], origin: 'agent' });
  assert.deepEqual(s.ctx.store.get(created.id)!.scope, []);

  // `always` and `severity: hard` on a rationale item ARE refused — but by
  // the inert-field rule (spec §3, `inertFieldError`), not by this boundary.
  // The two are distinguishable by origin: `guardedChange` refuses a
  // non-human caller and lets a human through, while the inert-field rule
  // refuses both identically, because the field does nothing for either of
  // them. Asserting both origins is what tells the two rules apart.
  for (const origin of ['agent', 'human'] as const) {
    assert.throws(
      () => updateItem(s.ctx, { id: created.id, always: true, origin }),
      /only governs on the normative tier/, origin,
    );
    assert.throws(
      () => updateItem(s.ctx, { id: created.id, severity: 'hard', origin }),
      /only governs on the normative tier/, origin,
    );
  }
  s.dispose();
});

test('a human is unaffected', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  updateItem(s.ctx, { id: created.id, scope: [], severity: 'hard', always: true });
  assert.deepEqual(s.ctx.store.get(created.id)?.scope, []);
  s.dispose();
});

test('scope is compared as a set — reordering it is not a change, so it is allowed', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool cap', scope: ['a/**', 'b/**'],
  });
  // Same set, sent back reordered — a model echoing what it read, or
  // `contentHash`'s own sort order. Must not be refused: it is not a change.
  updateItem(s.ctx, { id: created.id, scope: ['b/**', 'a/**'], origin: 'agent' });
  assert.deepEqual([...s.ctx.store.get(created.id)!.scope].sort(), ['a/**', 'b/**']);
  s.dispose();
});

test('a genuine scope change is still refused even when member counts match', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool cap', scope: ['a/**', 'b/**'],
  });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, scope: ['a/**', 'c/**'], origin: 'agent' }),
    /cannot change the scope of a governing normative item/i,
  );
  assert.deepEqual(s.ctx.store.get(created.id)?.scope, ['a/**', 'b/**']);
  s.dispose();
});

test('passing an unchanged value for a guarded field is not a change, so it is allowed', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool cap', scope: ['src/db/**'], severity: 'hard',
  });
  // Re-sending the item's current values (a model echoing back what it read)
  // changes nothing and must not be refused.
  updateItem(s.ctx, {
    id: created.id, scope: ['src/db/**'], severity: 'hard', always: false, origin: 'agent',
  });
  assert.deepEqual(s.ctx.store.get(created.id)?.scope, ['src/db/**']);
  s.dispose();
});
