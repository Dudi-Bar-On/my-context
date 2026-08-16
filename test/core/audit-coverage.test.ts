/**
 * **The enumerating test that stands in for a compile-time check.**
 *
 * `auditMutation` (mutate.ts) is called at the point each mutation function
 * KNOWS it succeeded, not inside `persist` — see its doc comment for why
 * `persist` is the wrong place (it runs inside `createItem`'s id-allocation
 * retry loop, where it would record writes that never happened). The cost of
 * that choice is that nothing fails to compile when a new mutation function
 * forgets to record.
 *
 * This file is what replaces it. It drives a REAL surface for every op in
 * `MUTATION_OPS` and asserts the record that appears. An op added to the
 * vocabulary with no surface emitting it fails `every mutation op is emitted
 * by a real surface`; a surface that stops recording fails the case that names
 * it. Neither can pass by inspection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAudit, MUTATION_OPS, type AuditRecord, type MutationOp } from '../../src/core/audit.ts';
import { createItem, supersedeItem, updateItem } from '../../src/core/mutate.ts';
import { linkItems, unlinkItems } from '../../src/core/relations.ts';
import { discardRevision, promoteRevision } from '../../src/core/revision.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/** Every op this file has actually driven, collected as the cases run. */
const covered = new Set<MutationOp>();

function ops(box: Sandbox): AuditRecord[] {
  return readAudit(box.root).filter((r) => r.kind === 'mutation');
}

function cover(op: MutationOp): void {
  covered.add(op);
}

test('create records who, what and when', () => {
  const box = sandbox();
  try {
    const result = createItem(box.ctx, {
      type: 'rule', title: 'A rule about writes', body: 'Do the thing.', origin: 'agent',
    });
    const records = ops(box);
    assert.equal(records.length, 1);
    assert.equal(records[0].op, 'create');
    assert.equal(records[0].origin, 'agent');
    assert.equal(records[0].itemId, result.id);
    assert.match(records[0].at, /^\d{4}-\d{2}-\d{2}T/);
    cover('create');
  } finally { box.dispose(); }
});

test('a duplicate create records nothing — nothing happened', () => {
  const box = sandbox();
  try {
    const input = {
      type: 'lesson' as const, title: 'A lesson', body: 'Body.', origin: 'human' as const,
    };
    createItem(box.ctx, input);
    const before = ops(box).length;
    const again = createItem(box.ctx, input);
    assert.equal(again.created, false, 'the second call must be a duplicate');
    assert.equal(ops(box).length, before);
  } finally { box.dispose(); }
});

test('update records the fields it MOVED, not the fields the call carried', () => {
  const box = sandbox();
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Original', body: 'Body one.', tags: ['a'], origin: 'human',
    });
    // `tags` is an echo — the item already has exactly this list — so it must
    // NOT appear in the record. `body` moved and must.
    updateItem(box.ctx, { id, body: 'Body two.', tags: ['a'], origin: 'human' });

    const record = ops(box).find((r) => r.op === 'update');
    assert.ok(record, 'no update record');
    assert.equal(record.itemId, id);
    assert.deepEqual(record.fields, ['body']);
    cover('update');
  } finally { box.dispose(); }
});

test('an agent content edit under review records a stage, and names the revision', () => {
  const box = sandbox({ categories: { rule: { agentEdits: 'review' } } });
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Governed', body: 'Body one.', status: 'active', origin: 'human',
    });
    const result = updateItem(box.ctx, { id, body: 'A proposal.', origin: 'agent' });
    assert.ok(result.staged, 'the edit should have staged rather than applied');

    const record = ops(box).find((r) => r.op === 'stage');
    assert.ok(record, 'no stage record');
    assert.equal(record.origin, 'agent');
    assert.equal(record.itemId, id);
    assert.deepEqual(record.fields, ['body']);
    assert.equal(record.note, result.staged.revisionId);
    // The proposed TEXT stays in the revision log; the audit log records the act.
    assert.equal(JSON.stringify(record).includes('A proposal.'), false);
    cover('stage');
  } finally { box.dispose(); }
});

test('promote records a promotion, not an indistinguishable update', () => {
  const box = sandbox({ categories: { rule: { agentEdits: 'review' } } });
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Governed', body: 'Body one.', status: 'active', origin: 'human',
    });
    updateItem(box.ctx, { id, body: 'A proposal.', origin: 'agent' });
    promoteRevision(box.ctx, id);

    const promoted = ops(box).filter((r) => r.op === 'promote');
    assert.equal(promoted.length, 1);
    assert.equal(promoted[0].origin, 'human');
    assert.equal(promoted[0].itemId, id);
    assert.deepEqual(promoted[0].fields, ['body']);
    // ONE record for the act: a promotion must not also appear as an `update`,
    // or the log would double-count and lose the distinction it exists to draw.
    assert.equal(ops(box).filter((r) => r.op === 'update').length, 0);
    cover('promote');
  } finally { box.dispose(); }
});

test('discard records the human decision, with the reason', () => {
  const box = sandbox({ categories: { rule: { agentEdits: 'review' } } });
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Governed', body: 'Body one.', status: 'active', origin: 'human',
    });
    updateItem(box.ctx, { id, body: 'A proposal.', origin: 'agent' });
    discardRevision(box.ctx, id, { reason: 'the rule is right as it stands' });

    const record = ops(box).find((r) => r.op === 'discard');
    assert.ok(record, 'no discard record');
    assert.equal(record.origin, 'human');
    assert.equal(record.itemId, id);
    assert.match(record.note ?? '', /the rule is right as it stands/);
    cover('discard');
  } finally { box.dispose(); }
});

test('supersede records one act on the retired item, naming its replacement', () => {
  const box = sandbox();
  try {
    const retired = createItem(box.ctx, {
      type: 'rule', title: 'Old rule', body: 'Old.', status: 'active', origin: 'human',
    });
    const replacement = createItem(box.ctx, {
      type: 'rule', title: 'New rule', body: 'New.', status: 'active', origin: 'human',
    });
    supersedeItem(box.ctx, { id: retired.id, by: replacement.id, origin: 'human' });

    const record = ops(box).find((r) => r.op === 'supersede');
    assert.ok(record, 'no supersede record');
    assert.equal(record.itemId, retired.id);
    assert.equal(record.note, `by ${replacement.id}`);
    cover('supersede');
  } finally { box.dispose(); }
});

test('link and unlink each record their own act, and who performed it', () => {
  const box = sandbox();
  try {
    const a = createItem(box.ctx, {
      type: 'rule', title: 'Rule A', body: 'A.', origin: 'human',
    });
    const b = createItem(box.ctx, {
      type: 'rule', title: 'Rule B', body: 'B.', origin: 'human',
    });

    linkItems(box.ctx, { from: a.id, to: b.id, relation: 'constrains', origin: 'agent' });
    const linked = ops(box).find((r) => r.op === 'link');
    assert.ok(linked, 'no link record');
    assert.equal(linked.origin, 'agent', 'an agent-added edge must not be recorded as the user\'s');
    assert.equal(linked.note, `constrains ${b.id}`);
    cover('link');

    unlinkItems(box.ctx, { from: a.id, to: b.id, relation: 'constrains' });
    const unlinked = ops(box).find((r) => r.op === 'unlink');
    assert.ok(unlinked, 'no unlink record');
    assert.equal(unlinked.origin, 'human', 'unlink has no agent surface — the CLI is the user');
    assert.equal(unlinked.note, `constrains ${b.id}`);
    cover('unlink');
  } finally { box.dispose(); }
});

test('refresh is recorded as a refresh, not as an editorial update', () => {
  const box = sandbox();
  try {
    const { id } = createItem(box.ctx, {
      type: 'rule', title: 'Snapshot holder', body: 'Old text.', origin: 'human',
    });
    // The op name is the caller's, exactly as `mycontext refresh` and the
    // `refresh_item` tool pass it — driven here directly so this case does not
    // depend on a reference item's snapshot machinery.
    updateItem(box.ctx, { id, body: 'New text.', origin: 'human' }, 'refresh');

    const record = ops(box).find((r) => r.op === 'refresh');
    assert.ok(record, 'no refresh record');
    assert.deepEqual(record.fields, ['body']);
    cover('refresh');
  } finally { box.dispose(); }
});

test('accept is recorded as an approval, not as a plain create', () => {
  const box = sandbox();
  try {
    // Same shape `acceptStagedRule` uses: a rule created with `auditOp:
    // 'accept'`, so the log can tell a rule a human WROTE from one a human
    // approved out of a derived candidate.
    createItem(box.ctx, {
      type: 'rule', title: 'Derived rule', body: 'Do the thing.', origin: 'human',
    }, 'accept');

    const record = ops(box).find((r) => r.op === 'accept');
    assert.ok(record, 'no accept record');
    cover('accept');
  } finally { box.dispose(); }
});

test('every mutation op is emitted by a real surface in this file', () => {
  const missing = MUTATION_OPS.filter((op) => !covered.has(op));
  assert.deepEqual(
    missing, [],
    `these ops are in MUTATION_OPS but no case above drives a surface that emits them: ` +
    `${missing.join(', ')}. Either wire the surface, or drop the op from the vocabulary — ` +
    `an op nothing can produce is a promise the log does not keep.`,
  );
});
