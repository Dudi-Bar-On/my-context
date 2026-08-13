import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createItem, linkItems, supersedeItem, updateItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

test('updateItem revises the body and keeps the id', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Old.' });
  const updated = updateItem(s.ctx, { id: created.id, body: 'New reason.' });

  assert.equal(updated.id, created.id);
  assert.equal(s.ctx.store.get(created.id)?.body, 'New reason.');
  s.dispose();
});

test('updateItem bumps the checksum when content changes', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Old.' });
  const before = s.ctx.store.get(created.id)!.checksum;
  updateItem(s.ctx, { id: created.id, body: 'New.' });
  assert.notEqual(s.ctx.store.get(created.id)!.checksum, before);
  s.dispose();
});

test('a retitled item keeps its slug and its file', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  updateItem(s.ctx, { id: created.id, title: 'Connection pool capped at 20' });

  const item = s.ctx.store.get('CONST-pool-cap');
  assert.equal(item?.title, 'Connection pool capped at 20');
  assert.equal(item?.filePath, 'items/constraint/CONST-pool-cap.md');
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

test('updateItem only touches the fields it was given', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool cap', body: 'Body.',
    scope: ['src/db/**'], tags: ['database'], severity: 'hard', always: true,
  });
  updateItem(s.ctx, { id: created.id, body: 'Rewritten.' });

  const item = s.ctx.store.get(created.id)!;
  assert.deepEqual(item.scope, ['src/db/**']);
  assert.deepEqual(item.tags, ['database']);
  assert.equal(item.severity, 'hard');
  assert.equal(item.always, true);
  s.dispose();
});

test('updateItem on an unknown id suggests the nearest', () => {
  const s = sandbox();
  createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: 'CONST-pool-capp', body: 'x' }),
    /no item with id "CONST-pool-capp".*CONST-pool-cap/s,
  );
  s.dispose();
});

test('an agent may edit a normative item but not its status', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });

  updateItem(s.ctx, { id: created.id, body: 'Extra rationale.', origin: 'agent' });
  assert.equal(s.ctx.store.get(created.id)?.body, 'Extra rationale.');

  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' }),
    /cannot change the status of a normative item/i,
  );
  assert.equal(s.ctx.store.get(created.id)?.status, 'active');
  s.dispose();
});

test('an agent may change the status of a rationale item', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'lesson', title: 'Locks matter' });
  updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' });
  assert.equal(s.ctx.store.get(created.id)?.status, 'deprecated');
  s.dispose();
});

test('a human may change the status of a normative item', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  updateItem(s.ctx, { id: created.id, status: 'deprecated' });
  assert.equal(s.ctx.store.get(created.id)?.status, 'deprecated');
  s.dispose();
});

test('supersede retires the old item without deleting anything', () => {
  const s = sandbox();
  const old = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 10', body: 'The original reason.',
  });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });

  supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'RDS instance resized.' });

  const retired = s.ctx.store.get(old.id)!;
  assert.equal(retired.status, 'superseded');
  assert.equal(retired.body, 'The original reason.');
  assert.match(retired.validUntil!, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(existsSync(path.join(s.root, ...retired.filePath.split('/'))));
  s.dispose();
});

test('supersede wires the relation onto the replacement', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  assert.deepEqual(s.ctx.store.get(next.id)?.relations, [
    { type: 'supersedes', target: old.id },
  ]);
  const text = readFileSync(path.join(s.root, 'items', 'constraint', `${next.id}.md`), 'utf8');
  assert.match(text, /- supersedes \[\[CONST-pool-capped-at-10\]\]/);
  s.dispose();
});

test('supersede records the reason as an observation on the replacement', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'RDS instance resized.' });

  const observations = s.ctx.store.get(next.id)!.observations;
  assert.equal(observations[0].category, 'supersession');
  assert.match(observations[0].text, /RDS instance resized/);
  s.dispose();
});

test('supersede refuses to point an item at itself', () => {
  const s = sandbox();
  const only = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(() => supersedeItem(s.ctx, { id: only.id, by: only.id }), /itself/i);
  s.dispose();
});

test('supersede names the unknown side of the pair', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: 'CONST-nope' }),
    /no item with id "CONST-nope"/,
  );
  s.dispose();
});

test('supersede is idempotent', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });
  const again = supersedeItem(s.ctx, { id: old.id, by: next.id });

  assert.equal(again.created, false);
  assert.equal(s.ctx.store.get(next.id)!.relations.length, 1);
  s.dispose();
});

test('linkItems adds a typed relation', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const b = createItem(s.ctx, { type: 'adr', title: 'Use SQLite JSONB' });
  const result = linkItems(s.ctx, { from: a.id, to: b.id, relation: 'derived_from' });

  assert.equal(result.created, true);
  assert.deepEqual(s.ctx.store.get(a.id)?.relations, [
    { type: 'derived_from', target: b.id },
  ]);
  s.dispose();
});

test('linkItems is idempotent', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const b = createItem(s.ctx, { type: 'adr', title: 'Use SQLite JSONB' });
  linkItems(s.ctx, { from: a.id, to: b.id, relation: 'derived_from' });
  const again = linkItems(s.ctx, { from: a.id, to: b.id, relation: 'derived_from' });

  assert.equal(again.created, false);
  assert.equal(s.ctx.store.get(a.id)!.relations.length, 1);
  s.dispose();
});

test('an unknown relation type is refused with the closest named', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const b = createItem(s.ctx, { type: 'adr', title: 'Use SQLite JSONB' });
  assert.throws(
    () => linkItems(s.ctx, { from: a.id, to: b.id, relation: 'derives_from' }),
    /closest match is "derived_from".*mycontext_help\("workflow"\)/s,
  );
  s.dispose();
});

test('a link to an item that does not exist yet is allowed and flagged', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const result = linkItems(s.ctx, { from: a.id, to: 'ADR-not-yet', relation: 'derived_from' });

  assert.equal(result.created, true);
  assert.match(result.message, /does not exist yet/i);
  assert.deepEqual(s.ctx.store.get(a.id)?.relations, [
    { type: 'derived_from', target: 'ADR-not-yet' },
  ]);
  s.dispose();
});
