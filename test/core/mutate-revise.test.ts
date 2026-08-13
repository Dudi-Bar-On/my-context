import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createItem, linkItems, persist, supersedeItem, updateItem } from '../../src/core/mutate.ts';
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

/**
 * The status-refusal message's "what else is editable" clause must match
 * reality for the item it is actually thrown about: a governing (active or
 * validated) normative item also refuses `scope`/`always`/`severity` (see
 * the field guard above this one in `updateItem`), so "every other field is
 * editable" is false for it — only title, body, tags and extra remain open.
 */
test('the status-refusal message on a governing item does not claim every other field is editable', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.equal(s.ctx.store.get(created.id)?.status, 'active');

  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' }),
    (err: unknown) => {
      const message = (err as Error).message;
      assert.match(message, /scope, always and severity are not/);
      assert.doesNotMatch(message, /Every other field is editable/);
      return true;
    },
  );
  s.dispose();
});

/** The same message on a draft normative item — which the field guard above
 * does not restrict at all — really does leave every other field editable,
 * so that is the wording it must use. */
test('the status-refusal message on a draft item says every other field is editable', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', origin: 'agent' });
  assert.equal(s.ctx.store.get(created.id)?.status, 'draft');

  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'active', origin: 'agent' }),
    (err: unknown) => {
      const message = (err as Error).message;
      assert.match(message, /Every other field is editable/);
      assert.doesNotMatch(message, /scope, always and severity are not/);
      return true;
    },
  );
  s.dispose();
});

/**
 * Widening R2: the guard `updateItem` places on a governing normative
 * item's `status` is stated for `origin === 'agent'` in the code, but its
 * rationale — only a human may retire or promote a governing normative
 * item — applies identically to any non-human origin. `'ingest'` must be
 * refused the same way `'agent'` is, or an ingestion pipeline could flip a
 * human's active constraint's status with nothing to stop it.
 */
test('ingest may edit a normative item but not its status', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });

  updateItem(s.ctx, { id: created.id, body: 'Extra rationale.', origin: 'ingest' });
  assert.equal(s.ctx.store.get(created.id)?.body, 'Extra rationale.');

  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'ingest' }),
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
    observations: [{ category: 'note', text: 'Observed under load.', tags: [], context: null }],
    relations: [{ type: 'constrains', target: 'ADR-elsewhere' }],
  });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });

  supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'RDS instance resized.' });

  const retired = s.ctx.store.get(old.id)!;
  assert.equal(retired.status, 'superseded');
  assert.equal(retired.body, 'The original reason.');
  assert.deepEqual(retired.observations, [
    { category: 'note', text: 'Observed under load.', tags: [], context: null },
  ]);
  assert.deepEqual(retired.relations, [{ type: 'constrains', target: 'ADR-elsewhere' }]);
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
  assert.throws(
    () => supersedeItem(s.ctx, { id: 'CONST-nope', by: old.id }),
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

// --- Review round: C1 — global-layer items are readable but never writable ---

test('updateItem refuses to write a global-layer item', () => {
  const s = sandbox();
  s.ctx.store.upsert({
    id: 'CONST-global-thing', type: 'constraint', title: 'Global thing', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: 'Original.', observations: [], relations: [], layer: 'global',
    filePath: 'items/constraint/CONST-global-thing.md',
  });

  assert.throws(
    () => updateItem(s.ctx, { id: 'CONST-global-thing', body: 'hacked' }),
    /global/i,
  );
  assert.equal(s.ctx.store.get('CONST-global-thing')?.body, 'Original.');
  s.dispose();
});

test('supersedeItem refuses when the retired item is global', () => {
  const s = sandbox();
  s.ctx.store.upsert({
    id: 'CONST-global-old', type: 'constraint', title: 'Global old', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: '', observations: [], relations: [], layer: 'global',
    filePath: 'items/constraint/CONST-global-old.md',
  });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });

  assert.throws(
    () => supersedeItem(s.ctx, { id: 'CONST-global-old', by: next.id }),
    /global/i,
  );
  s.dispose();
});

test('supersedeItem refuses when the replacement item is global', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  s.ctx.store.upsert({
    id: 'CONST-global-next', type: 'constraint', title: 'Global next', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: '', observations: [], relations: [], layer: 'global',
    filePath: 'items/constraint/CONST-global-next.md',
  });

  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: 'CONST-global-next' }),
    /global/i,
  );
  s.dispose();
});

test('linkItems refuses to write a global-layer "from" item', () => {
  const s = sandbox();
  s.ctx.store.upsert({
    id: 'CONST-global-from', type: 'constraint', title: 'Global from', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: '', observations: [], relations: [], layer: 'global',
    filePath: 'items/constraint/CONST-global-from.md',
  });
  const b = createItem(s.ctx, { type: 'adr', title: 'Use SQLite JSONB' });

  assert.throws(
    () => linkItems(s.ctx, { from: 'CONST-global-from', to: b.id, relation: 'derived_from' }),
    /global/i,
  );
  s.dispose();
});

// --- Review round: C2 — supersede cannot be used to demote a human's governing item ---

test('an agent cannot supersede a governing (active) normative item', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20', origin: 'agent' });

  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: next.id, origin: 'agent' }),
    /cannot supersede a governing normative item/i,
  );
  assert.equal(s.ctx.store.get(old.id)?.status, 'active');
  s.dispose();
});

test('an agent cannot supersede a validated normative item', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10', status: 'validated' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20', origin: 'agent' });

  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: next.id, origin: 'agent' }),
    /cannot supersede a governing normative item/i,
  );
  s.dispose();
});

/**
 * Widening R2: `supersedeItem`'s refusal for retiring a governing normative
 * item is gated on `origin === 'agent'` in the code; the same rationale —
 * retiring a governing normative item is a human decision — applies to
 * `'ingest'`, so it must be refused identically.
 */
test('ingest cannot supersede a governing (active) normative item', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20', origin: 'ingest' });

  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: next.id, origin: 'ingest' }),
    /cannot supersede a governing normative item/i,
  );
  assert.equal(s.ctx.store.get(old.id)?.status, 'active');
  s.dispose();
});

test('an agent may supersede its own draft normative item', () => {
  const s = sandbox();
  const draft = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10', origin: 'agent' });
  assert.equal(draft.status, 'draft');
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20', origin: 'agent' });

  const result = supersedeItem(s.ctx, { id: draft.id, by: next.id, origin: 'agent' });
  assert.equal(result.created, true);
  assert.equal(s.ctx.store.get(draft.id)?.status, 'superseded');
  s.dispose();
});

test('an agent may supersede an already-deprecated normative item', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10', status: 'deprecated' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20', origin: 'agent' });

  const result = supersedeItem(s.ctx, { id: old.id, by: next.id, origin: 'agent' });
  assert.equal(result.created, true);
  s.dispose();
});

test('an agent may supersede an active rationale item', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'lesson', title: 'Locks matter' });
  const next = createItem(s.ctx, { type: 'lesson', title: 'Locks matter, revised', origin: 'agent' });

  const result = supersedeItem(s.ctx, { id: old.id, by: next.id, origin: 'agent' });
  assert.equal(result.created, true);
  s.dispose();
});

test('a human may supersede a governing normative item', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });

  const result = supersedeItem(s.ctx, { id: old.id, by: next.id });
  assert.equal(result.created, true);
  s.dispose();
});

test("updateItem's refusal message does not advertise supersede_item as a status bypass", () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  try {
    updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' });
    assert.fail('expected updateItem to throw');
  } catch (err) {
    assert.doesNotMatch((err as Error).message, /supersede_item/);
  }
  s.dispose();
});

// --- Review round: I3 — tierOf fails closed when a type is missing from config ---

test('an item whose type is missing from config is treated as normative (fails closed)', () => {
  const s = sandbox();
  s.ctx.store.upsert({
    id: 'GHOST-orphan', type: 'removed_category', title: 'Orphaned item', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: '', observations: [], relations: [], layer: 'project',
    filePath: 'items/removed_category/GHOST-orphan.md',
  });

  assert.throws(
    () => updateItem(s.ctx, { id: 'GHOST-orphan', status: 'deprecated', origin: 'agent' }),
    /cannot change the status of a normative item/i,
  );
  s.dispose();
});

// --- Review round: I4 — validator symmetry and content preservation are now tested ---

test('updateItem refuses an invalid status', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'activ' as never }),
    /"status" must be one of/,
  );
  s.dispose();
});

test('updateItem refuses an invalid severity', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, severity: 'medium' as never }),
    /"severity" must be one of/,
  );
  s.dispose();
});

test('updateItem refuses an invalid origin', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, origin: 'robot' as never }),
    /"origin" must be one of/,
  );
  s.dispose();
});

test('updateItem refuses an extra key the frontmatter grammar rejects', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, extra: { 'valid-until': '2026-01-01' } }),
    /not a valid key/,
  );
  s.dispose();
});

test('updateItem refuses a reserved extra key', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, extra: { id: 'CONST-hijack' } }),
    /reserved frontmatter field/,
  );
  s.dispose();
});

// --- Review round: I5 — the promotion-path message describes what actually works today ---

test('the draft message names editing the Markdown file, not just mycontext review', () => {
  const s = sandbox();
  const result = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20', origin: 'agent' });
  assert.match(result.message, /editing/i);
  assert.match(result.message, /not implemented yet/i);
  s.dispose();
});

test("an agent's status-refusal message names editing the Markdown file, not just mycontext review", () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' }),
    /edit.*Markdown|Markdown.*edit/i,
  );
  s.dispose();
});

// --- Review round: minor fixes ---

test('linkItems refuses a self-link', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(() => linkItems(s.ctx, { from: a.id, to: a.id, relation: 'derived_from' }), /itself/i);
  s.dispose();
});

test('linkItems refuses relation "supersedes" and routes to supersede_item', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const b = createItem(s.ctx, { type: 'constraint', title: 'Pool cap v2' });
  assert.throws(
    () => linkItems(s.ctx, { from: a.id, to: b.id, relation: 'supersedes' }),
    /supersede_item/,
  );
  s.dispose();
});

test('a repeat supersede after a status reset does not duplicate the reason observation', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'RDS instance resized.' });

  // The relation onto `next` stays wired, but the retiree's own status is
  // reset by a human — the idempotent short-circuit (relation wired AND
  // status already 'superseded') no longer applies, so this exercises the
  // real repeat path rather than the trivial early return.
  updateItem(s.ctx, { id: old.id, status: 'active' });
  supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'RDS instance resized.' });

  assert.equal(s.ctx.store.get(next.id)!.observations.length, 1);
  s.dispose();
});

test('updateItem sets validUntil when status moves to superseded', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  updateItem(s.ctx, { id: created.id, status: 'superseded' });
  assert.match(s.ctx.store.get(created.id)!.validUntil!, /^\d{4}-\d{2}-\d{2}$/);
  s.dispose();
});

test('updateItem sets validUntil when status moves to deprecated', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  updateItem(s.ctx, { id: created.id, status: 'deprecated' });
  assert.match(s.ctx.store.get(created.id)!.validUntil!, /^\d{4}-\d{2}-\d{2}$/);
  s.dispose();
});

/**
 * Discriminating, unlike the version this replaced: the old test's second
 * call passed no `status` at all, so it never entered the
 * `if (input.status !== undefined)` block whose `validUntil === null` guard
 * it claimed to be testing — removing that guard left it green. This drives
 * a SECOND retiring status change while `validUntil` is already set to a
 * distinguishable past date, which is the only way the guard is reachable.
 */
test('updateItem does not overwrite an already-set validUntil', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  updateItem(s.ctx, { id: created.id, status: 'deprecated' });

  // Backdate it, so "kept" and "recomputed as today" cannot look the same.
  const backdated = s.ctx.store.get(created.id)!;
  backdated.validUntil = '2020-01-01';
  persist(s.ctx, backdated);

  updateItem(s.ctx, { id: created.id, status: 'superseded' });
  assert.equal(s.ctx.store.get(created.id)!.validUntil, '2020-01-01');
  assert.equal(s.ctx.store.get(created.id)!.status, 'superseded');
  s.dispose();
});

// --- CRITICAL: updateItem must not re-render destroyed content over the file ---

test('updateItem refuses a body containing a Markdown heading', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Keep this.' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, body: 'Keep this.\n\n## Rationale\n\nWhy.' }),
    /my_context: .*## Rationale/,
  );
  // And the item on disk is untouched.
  assert.equal(s.ctx.store.get(created.id)!.body, 'Keep this.');
  s.dispose();
});

test('supersede_item refuses a reason that would be mangled into tags and context', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'see #4521' }),
    /my_context: .*#4521/,
  );
  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'resized (again)' }),
    /my_context: .*\(again\)/,
  );
  s.dispose();
});
