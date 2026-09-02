import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../../src/core/config.ts';
import { createItem, supersedeItem, updateItem } from '../../src/core/mutate.ts';
import { persist } from '../../src/core/persist.ts';
import { linkItems, RELATION_TYPES } from '../../src/core/relations.ts';
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
    scope: ['src/db/**'], tags: ['database'], severity: 'hard', always: true, continuity: false,
  });
  updateItem(s.ctx, { id: created.id, body: 'Rewritten.' });

  const item = s.ctx.store.get(created.id)!;
  assert.deepEqual(item.scope, ['src/db/**']);
  assert.deepEqual(item.tags, ['database']);
  assert.equal(item.severity, 'hard');
  assert.equal(item.always, true);
  s.dispose();
});

// --- IMPORTANT: update_item is a first-class MCP surface, not merely
// ingest-adjacent — it needs the same title/body/scope/tags/extra guards
// create_item has for the identical fields, and normalizes body the same
// way (CRITICAL 1's fix, applied here too). ---

test('updateItem refuses a title containing a newline, not written as an unparseable file', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, title: 'Line one\nLine two' }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /"title" contains a line break/);
      return true;
    },
  );
  s.dispose();
});

test('updateItem refuses a scope glob containing a newline', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, scope: ['a\nb/**'] }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /scope\[0\] contains a line break/);
      return true;
    },
  );
  s.dispose();
});

test('updateItem refuses a tag containing a newline', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, tags: ['a\nb'] }),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /tags\[0\] contains a line break/);
      return true;
    },
  );
  s.dispose();
});

test('updateItem normalizes a body with bare-CR line endings before storing it, not raw', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Old.' });
  updateItem(s.ctx, { id: created.id, body: 'Line one.\rLine two.' });
  const item = s.ctx.store.get(created.id)!;
  assert.equal(item.body, 'Line one.\nLine two.');
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

/**
 * `agentEdits: 'allow'` is set explicitly here and in the `ingest` sibling
 * below, because the point of both tests is that the STATUS guard is narrow —
 * that a non-human caller's ordinary content edit is not caught by it. Under
 * the normative default (`review`, config.ts) that content edit is accepted
 * and STAGED rather than applied, which is spec §4's behaviour and is pinned
 * in `test/core/agent-edits.test.ts`; leaving it to the default here would
 * make these two tests assert the staging policy instead of the guard they
 * are about.
 */
test('an agent may edit a normative item but not its status', () => {
  const s = sandbox({ categories: { constraint: { agentEdits: 'allow' } } });
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
  const s = sandbox({ categories: { constraint: { agentEdits: 'allow' } } });
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
  // The retiree's own authored relation is untouched and stays FIRST; the
  // back-reference is appended, never a replacement for what was there.
  assert.deepEqual(retired.relations, [
    { type: 'constrains', target: 'ADR-elsewhere' },
    { type: 'superseded_by', target: next.id },
  ]);
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

/**
 * `STD-answered-questions-are-superseded` — an active standard in this
 * project's own corpus — requires an answered item to be set `superseded`
 * AND to carry a `superseded_by` relation naming what answered it. Before
 * this, `supersedeItem` wrote only the forward `supersedes` edge onto the
 * replacement, `superseded_by` was in no vocabulary any write path would
 * accept, and the plugin therefore injected a standard its own code made
 * impossible to follow.
 */
test('supersede writes the superseded_by back-reference onto the retired item', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'open_question', title: 'Do we shard by tenant' });
  const next = createItem(s.ctx, { type: 'decision', title: 'Shard by tenant' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  assert.deepEqual(s.ctx.store.get(old.id)?.relations, [
    { type: 'superseded_by', target: next.id },
  ]);
  // On disk, not only in the index: the file is the source of truth
  // (INV-markdown-is-the-source-of-truth), and an edge that lived only in
  // SQLite would vanish on the next rebuild.
  const text = readFileSync(path.join(s.root, ...old.filePath.split('/')), 'utf8');
  assert.match(text, new RegExp(`- superseded_by \\[\\[${next.id}\\]\\]`));
  s.dispose();
});

/**
 * **An item records exactly ONE successor, and the idempotent early return was
 * never the guard that said so.** This is the test that fails without the fix.
 *
 * That return fires only when the forward edge AND the back edge exist for the
 * SAME pair. Superseding an already-retired item with a DIFFERENT replacement
 * matched neither flag and fell through to `retired.relations.push`, so the
 * file ended up asserting two successors — and `superseded_by` is the only
 * route from a retired item back to what replaced it, so two answers is as
 * useless as none.
 */
test('superseding an already-superseded item with a different replacement is refused', () => {
  const s = sandbox();
  const question = createItem(s.ctx, { type: 'open_question', title: 'Shard by tenant or region' });
  const first = createItem(s.ctx, { type: 'decision', title: 'Shard by tenant' });
  const second = createItem(s.ctx, { type: 'decision', title: 'Shard by region after all' });

  supersedeItem(s.ctx, { id: question.id, by: first.id });

  let text = '';
  try {
    supersedeItem(s.ctx, { id: question.id, by: second.id });
    assert.fail('a second, different successor was accepted');
  } catch (err) {
    text = (err as Error).message;
  }
  // The refusal NAMES the successor already recorded — without it the reader
  // is told "no" and not told what to look at.
  assert.match(text, new RegExp(`already superseded by ${first.id}`));
  assert.match(text, new RegExp(`supersede ${first.id} by ${second.id}`));

  // Refused AND not written: one back-edge, still pointing at the first.
  assert.deepEqual(s.ctx.store.get(question.id)?.relations, [
    { type: 'superseded_by', target: first.id },
  ]);
  // And nothing was written to the would-be replacement either.
  assert.deepEqual(s.ctx.store.get(second.id)?.relations, []);
  // On disk too, because the file is the source of truth.
  const text2 = readFileSync(path.join(s.root, ...question.filePath.split('/')), 'utf8');
  assert.equal((text2.match(/- superseded_by /g) ?? []).length, 1);
  s.dispose();
});

/**
 * The same pair, repeated, still returns the idempotent answer. Without this
 * the refusal above could have been written as "already superseded, full
 * stop", which would break the repair path `backWired` exists for.
 */
test('superseding by the SAME replacement again is still the idempotent no-op', () => {
  const s = sandbox();
  const question = createItem(s.ctx, { type: 'open_question', title: 'Shard by tenant or region' });
  const answer = createItem(s.ctx, { type: 'decision', title: 'Shard by tenant' });
  supersedeItem(s.ctx, { id: question.id, by: answer.id });

  const again = supersedeItem(s.ctx, { id: question.id, by: answer.id });
  assert.match(again.message, /is already superseded by/);
  assert.deepEqual(s.ctx.store.get(question.id)?.relations, [
    { type: 'superseded_by', target: answer.id },
  ]);
  s.dispose();
});

/**
 * **`supersedes` is deliberately NOT capped, and the asymmetry is the truth
 * about retirement rather than an oversight.** One replacement legitimately
 * retires several items — a decision that answers four open questions is the
 * ordinary case — so a cap on the replacement's side would refuse real work.
 * The cardinality belongs on the RETIREE, where "what replaced this?" has
 * exactly one answer.
 */
test('one replacement may retire many items: supersedes is not capped', () => {
  const s = sandbox();
  const answer = createItem(s.ctx, { type: 'decision', title: 'Shard by tenant' });
  const q1 = createItem(s.ctx, { type: 'open_question', title: 'Shard by tenant or region' });
  const q2 = createItem(s.ctx, { type: 'open_question', title: 'One database or many' });

  supersedeItem(s.ctx, { id: q1.id, by: answer.id });
  supersedeItem(s.ctx, { id: q2.id, by: answer.id });

  assert.deepEqual(s.ctx.store.get(answer.id)?.relations, [
    { type: 'supersedes', target: q1.id },
    { type: 'supersedes', target: q2.id },
  ]);
  s.dispose();
});

/**
 * The door NOT used. `superseded_by` is written only inside `supersedeItem`;
 * it is deliberately absent from `RELATION_TYPES` because that list is the
 * whole gate on `linkItems`, which is agent-reachable through the
 * `link_items` MCP tool and takes no `origin` at all. Listing it there would
 * let an agent stamp a retirement-direction edge onto a still-active
 * governing item with none of the lifecycle changes that make it true.
 */
test('superseded_by cannot be forged through link_items', () => {
  assert.ok(
    !RELATION_TYPES.includes('superseded_by'),
    'superseded_by must NOT be in RELATION_TYPES — that list is the only gate on link_items, ' +
    'which has no origin check at all.',
  );

  const s = sandbox();
  const active = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 10', status: 'active', origin: 'human',
  });
  const other = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });

  assert.throws(
    () => linkItems(s.ctx, { from: active.id, to: other.id, relation: 'superseded_by' }),
    /cannot be added with link_items/,
  );
  // Refused AND not written: an item left carrying the edge while still
  // `active` is the contradiction the refusal exists to prevent.
  assert.deepEqual(s.ctx.store.get(active.id)?.relations, []);
  assert.equal(s.ctx.store.get(active.id)?.status, 'active');
  s.dispose();
});

/**
 * The refusal used to print ONE ready-made remedy, `supersede_item(id: to,
 * by: from)`. Executed, that retires the item named by `to` — so an agent
 * recording "this question was answered by that decision" as `from:
 * <question>, to: <answer>` retired the ANSWER and left the question
 * standing. Verified by execution before this changed. The message must name
 * which item gets retired in each ordering rather than hand over one command
 * to copy.
 */
test('the retirement-relation refusal names both orderings, not one inverted remedy', () => {
  const s = sandbox();
  const question = createItem(s.ctx, { type: 'open_question', title: 'Shard by tenant or region' });
  const answer = createItem(s.ctx, { type: 'decision', title: 'Shard by tenant' });

  for (const relation of ['supersedes', 'superseded_by']) {
    let text = '';
    try {
      linkItems(s.ctx, { from: question.id, to: answer.id, relation });
      assert.fail(`link_items accepted "${relation}"`);
    } catch (err) {
      text = (err as Error).message;
    }
    assert.match(text, new RegExp(`supersede_item\\(id: "${question.id}", by: "${answer.id}"\\)`));
    assert.match(text, new RegExp(`supersede_item\\(id: "${answer.id}", by: "${question.id}"\\)`));
    assert.match(text, /RETIRED/);
  }
  s.dispose();
});

/**
 * A pair superseded before the back-reference existed has the forward edge
 * and not the mirror. If the idempotent early return keyed on the forward
 * edge alone, that pair could never be repaired — the command would report
 * "already superseded" and write nothing, forever.
 */
test('supersede backfills a missing superseded_by on an already-retired pair', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  // Re-create the pre-back-reference state exactly: status superseded,
  // forward edge present, mirror absent.
  const retired = s.ctx.store.get(old.id)!;
  retired.relations = retired.relations.filter((r) => r.type !== 'superseded_by');
  persist(s.ctx, retired);
  assert.deepEqual(s.ctx.store.get(old.id)?.relations, []);

  const again = supersedeItem(s.ctx, { id: old.id, by: next.id });
  assert.equal(again.created, true);
  assert.deepEqual(s.ctx.store.get(old.id)?.relations, [
    { type: 'superseded_by', target: next.id },
  ]);
  // The forward edge is not duplicated by the repair pass.
  assert.equal(s.ctx.store.get(next.id)!.relations.length, 1);
  s.dispose();
});

test('supersede keeps exactly one superseded_by when run twice', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  assert.deepEqual(s.ctx.store.get(old.id)?.relations, [
    { type: 'superseded_by', target: next.id },
  ]);
  s.dispose();
});

/**
 * `by` is now written verbatim into `- superseded_by [[...]]` on the
 * retiree, so it needs the guard `id` already had. A `]` in the target
 * round-trips to a truncated relation — silently, on the next rebuild.
 */
test('supersede validates the replacement id as a relation target', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: 'CONST-a]b' }),
    /"by" contains "\]"/,
  );
  // Refused before anything was written: the retiree is untouched (it was
  // created with the default `origin: 'human'`, so it is active).
  assert.equal(s.ctx.store.get(old.id)?.status, 'active');
  assert.deepEqual(s.ctx.store.get(old.id)?.relations, []);
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

/**
 * **The four adopted on 2026-09-02, exercised through the gate that admits
 * them.** `RELATION_TYPES` is the whole of what `linkItems` checks, so a name
 * added to the list and nowhere else is a name that has never been written —
 * this is `derived_from`'s own coverage above, applied to each of them.
 *
 * `conflicts_with` is the one SYMMETRIC member, and it is asserted here that
 * the mirror is NOT stored. Symmetry is a fact about what the edge MEANS, and
 * writing both halves would create a second edge to keep in step with the
 * first — inverse traversal needs no stored inverse, which `apiGraph`'s
 * bidirectional walk already demonstrates.
 */
test('linkItems writes each relation adopted in 2026-09-02, and stores no mirror', () => {
  for (const relation of ['depends_on', 'caused_by', 'conflicts_with', 'amends']) {
    const s = sandbox();
    const a = createItem(s.ctx, { type: 'rule', title: 'A rule' });
    const b = createItem(s.ctx, { type: 'lesson', title: 'A lesson' });
    linkItems(s.ctx, { from: a.id, to: b.id, relation });

    assert.deepEqual(s.ctx.store.get(a.id)?.relations, [{ type: relation, target: b.id }], relation);
    assert.deepEqual(s.ctx.store.get(b.id)?.relations, [], `${relation} stored a mirror edge`);

    // It survives the file, not only the index — an edge that lived in SQLite
    // alone would vanish on the next rebuild.
    const text = readFileSync(path.join(s.root, ...a.filePath.split('/')), 'utf8');
    assert.match(text, new RegExp(`- ${relation} \\[\\[${b.id}\\]\\]`), relation);
    s.dispose();
  }
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
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: 'Original.', steps: [], observations: [], relations: [], layer: 'global',
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
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [], layer: 'global',
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
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [], layer: 'global',
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
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [], layer: 'global',
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
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [], layer: 'project',
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
// --- Task 10 review: `mycontext review` shipped, so the message must say so
//     rather than still claiming it "is not implemented yet" (the eighteenth
//     instance of that pattern, per the Task 10 review). ---

test('the draft message tells the caller to promote it with mycontext review promote', () => {
  const s = sandbox();
  const result = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20', origin: 'agent' });
  assert.match(result.message, /mycontext review promote/);
  assert.doesNotMatch(result.message, /not implemented yet/i);
  s.dispose();
});

// `mycontext edit --status` shipped, so this message no longer has to send a
// human to the Markdown file — and must not, since a hand edit is the one
// route this project's documentation may not instruct. The full wording,
// including the prohibition and the `supersede` exception, is pinned in
// `test/core/mutate-guard-messages.test.ts`.
test("an agent's status-refusal message on a GOVERNING item names mycontext edit --status", () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' }),
    /mycontext edit .* --status/,
  );
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' }),
    (err: Error) => !/Markdown/i.test(err.message),
  );
  s.dispose();
});

test("an agent's status-refusal message on a DRAFT names mycontext review promote", () => {
  const s = sandbox();
  // An agent-authored normative item lands as draft; a second agent call
  // attempting to force it straight to "active" hits the same status guard,
  // but review promote genuinely applies here — the item really is a draft.
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', origin: 'agent' });
  assert.equal(s.ctx.store.get(created.id)?.status, 'draft');
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'active', origin: 'agent' }),
    /mycontext review promote/,
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

test('linkItems refuses a "to" target containing "]" — it would truncate the stored relation', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => linkItems(s.ctx, { from: a.id, to: 'a]b', relation: 'derived_from' }),
    /relation target/,
  );
  assert.equal(s.ctx.store.get(a.id)?.relations.length, 0);
  s.dispose();
});

test('linkItems refuses a "to" target containing a line break — it would drop the relation entirely', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => linkItems(s.ctx, { from: a.id, to: 'x\ny', relation: 'derived_from' }),
    /line break/,
  );
  assert.equal(s.ctx.store.get(a.id)?.relations.length, 0);
  s.dispose();
});

test('createItem refuses a relations[].target containing "]"', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'constraint', title: 'Pool cap',
      relations: [{ type: 'derived_from', target: 'a]b' }],
    }),
    /relation target/,
  );
  assert.equal(s.ctx.store.all().length, 0);
  s.dispose();
});

test('createItem refuses a relations[].target containing a line break', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'constraint', title: 'Pool cap',
      relations: [{ type: 'derived_from', target: 'x\ny' }],
    }),
    /line break/,
  );
  assert.equal(s.ctx.store.all().length, 0);
  s.dispose();
});

test('createItem refuses an explicit id containing "]" — it would corrupt a future supersedes relation targeting it', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'Pool cap', id: 'CONST-a]b' }),
    /relation target/,
  );
  assert.equal(s.ctx.store.all().length, 0);
  s.dispose();
});

test('createItem refuses an empty explicit id', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: 'Pool cap', id: '' }),
    /is empty/,
  );
  s.dispose();
});

test('supersedeItem refuses a malformed retiree id before even looking it up', () => {
  const s = sandbox();
  assert.throws(
    () => supersedeItem(s.ctx, { id: 'CONST-a]b', by: 'CONST-whatever' }),
    /relation target/,
  );
  s.dispose();
});

test('linkItems refuses an empty "to" target', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => linkItems(s.ctx, { from: a.id, to: '', relation: 'derived_from' }),
    /is empty/,
  );
  assert.equal(s.ctx.store.get(a.id)?.relations.length, 0);
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

/**
 * 1C.5 — `valid_until` was stamped on the way INTO a retired status and left
 * there on the way out, so an un-retired item's frontmatter said `status:
 * active` and `valid_until: <a date>` at the same time.
 *
 * The field is a lifecycle RECORD, not a control input — nothing selects on
 * it, deliberately; see `stampValidUntil` (mutate.ts) — so what it owes is
 * agreement with the status beside it, in both directions.
 */
test('valid_until is stamped on retirement and cleared when the item comes back', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'decision', title: 'Use Postgres' });
  assert.equal(s.ctx.store.get(created.id)!.validUntil, null);

  updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'human' });
  const retired = s.ctx.store.get(created.id)!;
  assert.match(retired.validUntil!, /^\d{4}-\d{2}-\d{2}$/);

  updateItem(s.ctx, { id: created.id, status: 'active', origin: 'human' });
  assert.equal(
    s.ctx.store.get(created.id)!.validUntil, null,
    'an active item still carrying valid_until says it stopped being in force',
  );
  // And the file on disk agrees — the Markdown is the source of truth.
  const disk = readFileSync(
    path.join(s.root, ...s.ctx.store.get(created.id)!.filePath.split('/')), 'utf8',
  );
  assert.match(disk, /^status: active$/m);
  assert.match(disk, /^valid_until: null$/m);
  s.dispose();
});

/** Every retired status, and every status that is not one. */
test('valid_until follows the status through each transition', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'decision', title: 'Use Postgres' });
  const stamped = (): boolean => s.ctx.store.get(created.id)!.validUntil !== null;

  for (const [status, expected] of [
    ['superseded', true], ['active', false], ['deprecated', true],
    ['validated', false], ['deprecated', true], ['draft', false],
  ] as [string, boolean][]) {
    updateItem(s.ctx, { id: created.id, status: status as never, origin: 'human' });
    assert.equal(stamped(), expected, `after --status ${status}`);
  }
  s.dispose();
});

/** A write that does not touch `status` leaves the record alone — clearing it
 * is a consequence of un-retiring, not of any edit. */
test('valid_until survives an edit that does not move the status', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'decision', title: 'Use Postgres' });
  updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'human' });
  const stamp = s.ctx.store.get(created.id)!.validUntil;

  updateItem(s.ctx, { id: created.id, body: 'Rewritten after the fact.', origin: 'human' });
  assert.equal(s.ctx.store.get(created.id)!.validUntil, stamp);
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

/**
 * The edit half of extra-field ownership. `updateItem` merges `extra`, so a key
 * the category does not declare would otherwise arrive at an item that already
 * exists — the same hole as at capture, reached through the tool an agent
 * actually holds.
 */
test('updateItem refuses an extra key the item category does not declare', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'risk', title: 'Index falls behind' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, extra: { directive: 'dont' } }),
    (err: Error) => {
      assert.match(err.message, /extra field "directive" is not declared by "risk"/);
      assert.match(err.message, /A "risk" declares: likelihood, impact\./);
      // The edit surface says "changed", not "written" — and it must be true.
      assert.match(err.message, /Nothing was changed\./);
      return true;
    },
  );
  assert.deepEqual(s.ctx.store.get(created.id)!.extra, {});
  s.dispose();
});

test('updateItem accepts an extra key the item category declares', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'risk', title: 'Index falls behind' });
  updateItem(s.ctx, { id: created.id, extra: { likelihood: 'low', impact: 'high' } });
  assert.deepEqual(s.ctx.store.get(created.id)!.extra, { likelihood: 'low', impact: 'high' });
  s.dispose();
});

/** Precedence on the edit surface too: reserved first, and its remedy is not
 * "declare it", which is the remedy the undeclared message would offer. */
test('updateItem refuses a reserved extra key as reserved, not as undeclared', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'rule', title: 'Never log customer email' });
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, extra: { status: 'active' } }),
    (err: Error) => {
      assert.match(err.message, /collides with a reserved frontmatter field/);
      assert.doesNotMatch(err.message, /is not declared by/);
      return true;
    },
  );
  s.dispose();
});

/** A config-declared field on a custom category is editable, not merely
 * capturable — the two surfaces read the same resolved category. `chore`
 * rather than `task`: `task` was adopted into the catalogue on 2026-09-02 and
 * now extends a shipped declaration instead of being the whole of one. */
test('updateItem accepts a config-declared extra field on a custom category', () => {
  const s = sandbox({
    categories: {
      chore: { tier: 'rationale', description: 'A unit of planned work', extraFields: ['state'] },
    },
  });
  const created = createItem(s.ctx, { type: 'chore', title: 'Ship it', extra: { state: 'todo' } });
  updateItem(s.ctx, { id: created.id, extra: { state: 'done' } });
  assert.equal(s.ctx.store.get(created.id)!.extra.state, 'done');
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, extra: { progress: '50' } }),
    /extra field "progress" is not declared by "chore"/,
  );
  s.dispose();
});

/** A value stored before a config change stays on disk and keeps rendering:
 * ownership refuses a new ASSERTION, it does not strand an item behind a field
 * it already carries — the same split `inertFieldError`/`inertFieldNote` draw.
 * Only re-asserting the now-undeclared key is refused. */
test('an item keeps an extra field its category stopped declaring, and stays editable', () => {
  const s = sandbox({
    categories: {
      chore: { tier: 'rationale', description: 'Work', extraFields: ['state', 'progress'] },
    },
  });
  const created = createItem(s.ctx, {
    type: 'chore', title: 'Ship it', extra: { state: 'todo', progress: '10' },
  });

  // The config narrows underneath the item, exactly as editing config.json
  // between two sessions would.
  s.ctx.config = resolveConfig({
    categories: { chore: { tier: 'rationale', description: 'Work', extraFields: ['state'] } },
  });

  // The stored value is untouched, on disk and in the index.
  assert.equal(s.ctx.store.get(created.id)!.extra.progress, '10');
  // Quoted, because a bare `10` would re-parse as a number — `serializeFrontmatter`
  // (frontmatter.ts) quotes any scalar that would.
  assert.match(readFileSync(path.join(s.root, ...created.filePath.split('/')), 'utf8'),
    /^progress: "10"$/m);

  // An edit naming only a still-declared key is accepted, and carries the
  // stored one through the merge untouched.
  updateItem(s.ctx, { id: created.id, extra: { state: 'done' } });
  assert.deepEqual(s.ctx.store.get(created.id)!.extra, { state: 'done', progress: '10' });

  // Re-asserting the dropped key is the one thing refused.
  assert.throws(
    () => updateItem(s.ctx, { id: created.id, extra: { progress: '50' } }),
    /extra field "progress" is not declared by "chore"/,
  );
  s.dispose();
});
