/**
 * The three buckets, and the warning the middle one IS.
 *
 * Two properties are worth naming before the tests, because they are what
 * these tests are for rather than incidental to them:
 *
 *  1. **The arithmetic.** Every incoming item lands in exactly one bucket, so
 *     the three counts sum to the incoming count. That is
 *     `INV-nothing-is-dropped-silently` in the one form a test can check
 *     without knowing anything about the items.
 *  2. **`differs` cannot drift from the predicate.** The buckets are decided
 *     by `itemContentHash`; the warning names fields. A field named in the
 *     warning that did not move the hash teaches a reader to distrust the
 *     warning, and a field that moved it without being named is the silent
 *     difference §6n.7 exists to surface. Both directions are asserted here
 *     against the hash itself, not against a list retyped from the module.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemContentHash } from '../../src/core/content-hash.ts';
import { comparePaths } from '../../src/pack/layout.ts';
import type { Item } from '../../src/core/types.ts';
import {
  bucketise, collisionJson, diffFields, renderCollisionReport,
  type CollisionReport,
} from '../../src/pack/collide.ts';

/** One complete `Item`, overridden field by field at each call site. */
function item(over: Partial<Item> = {}): Item {
  return {
    id: 'RULE-a',
    type: 'rule',
    title: 'A rule',
    status: 'active',
    severity: 'soft',
    always: false,
    continuity: false,
    scope: [],
    tags: [],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    validFrom: null,
    validUntil: null,
    checksum: 'not-part-of-content',
    extra: {},
    body: 'the body',
    steps: [],
    observations: [],
    relations: [],
    layer: 'project',
    filePath: 'items/rule/RULE-a.md',
    ...over,
  };
}

/**
 * The `existing` lookup `bucketise` takes, over a handful of local items.
 * It returns `null` for a miss, which is the spelling `Store.get` uses
 * (`core/store.ts` · `  get(id: string): Item | null {`) and the one §0 item 1
 * corrects the survey's `undefined` to.
 */
function corpus(...items: Item[]): (id: string) => Item | null {
  const byId = new Map(items.map((i) => [i.id, i]));
  return (id: string): Item | null => byId.get(id) ?? null;
}

/** A whole report with nothing in it; each test overrides what it is about. */
function report(over: Partial<CollisionReport> = {}): CollisionReport {
  return {
    pack: 'acme-security',
    version: '2026-08 rev 3',
    kind: 'pack',
    source: '../packs/acme-security.zip',
    format: 'zip',
    manifest: { files: 24, verified: 24, missing: [], extra: [], mismatched: [] },
    buckets: { new: [], changed: [], identical: [] },
    config: { merged: [], refused: [], untouched: [] },
    history: { records: 0, quarantined: 0 },
    notCarried: [],
    refused: [],
    applied: false,
    overwriteApproved: false,
    overwritten: [],
    loadErrors: [],
    ...over,
  };
}

/**
 * The ids listed under one bucket heading, in the order they were rendered.
 *
 * An entry row is `  <id> …`; a detail line under one is indented past the id
 * column, so the leading-two-spaces-then-text shape selects entries and
 * nothing else. The section ends at the next heading or the next blank line.
 */
function renderedIds(lines: readonly string[], bucket: string): string[] {
  const start = lines.indexOf(`${bucket}:`);
  assert.notEqual(start, -1, `the report has no "${bucket}:" section`);
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line === '' || !line.startsWith('  ')) break;
    const entry = /^ {2}(\S+)/.exec(line);
    if (entry !== null) out.push(entry[1]);
  }
  return out;
}

/**
 * The rendered report as one string, with every run of whitespace collapsed.
 *
 * The prose assertions below are about SENTENCES, and the renderer wraps its
 * sentences to the layout budget — so a plain `join('\n')` would make each of
 * them depend on where the break happened to fall, which in turn depends on
 * the longest id in the fixture. Flattening asserts what the tests are
 * actually about, and is strictly stronger for `doesNotMatch`: a withdrawn
 * sentence split across two lines would slip past the unflattened form.
 */
function flat(lines: readonly string[]): string {
  return lines.join('\n').replace(/\s+/g, ' ');
}

/** A pack of two changed items — one overwritable, one not — and one of each other bucket. */
function mixed(): CollisionReport {
  const here = [
    item({ id: 'STD-commit-messages', type: 'standard', title: 'Commit messages', body: 'ours' }),
    item({
      id: 'LESSON-retry-backoff', type: 'lesson', title: 'Retry with backoff', status: 'draft',
    }),
    item({ id: 'INV-paths-are-posix', type: 'invariant', title: 'Paths are POSIX' }),
  ];
  const incoming = [
    item({
      id: 'STD-commit-messages', type: 'standard', title: 'Commit messages', body: 'theirs',
      tags: ['git'],
    }),
    item({
      id: 'LESSON-retry-backoff', type: 'lesson', title: 'Retry with backoff', status: 'draft',
      observations: [{ category: 'evidence', text: 'seen twice', tags: [], context: null }],
    }),
    item({ id: 'INV-paths-are-posix', type: 'invariant', title: 'Paths are POSIX' }),
    item({ id: 'RULE-never-log-a-token', title: 'Never log a token' }),
  ];
  return report({ buckets: bucketise(incoming, corpus(...here)) });
}

// ---------------------------------------------------------------------------
// The buckets
// ---------------------------------------------------------------------------

test('the three counts sum to the incoming item count — the arithmetic form of nothing-dropped', () => {
  const here = corpus(
    item({ id: 'RULE-same', body: 'shared' }),
    item({ id: 'RULE-drift', body: 'here' }),
  );
  const incoming = [
    item({ id: 'RULE-fresh' }),
    item({ id: 'RULE-same', body: 'shared' }),
    item({ id: 'RULE-drift', body: 'there' }),
  ];

  const b = bucketise(incoming, here);

  assert.equal(b.new.length + b.changed.length + b.identical.length, incoming.length);
  assert.equal(b.new.length, 1);
  assert.equal(b.changed.length, 1);
  assert.equal(b.identical.length, 1);
});

test('a lookup returning null means new — the codebase spells absence as null, not undefined', () => {
  const one = item({ id: 'RULE-alone' });
  assert.deepEqual(bucketise([one], () => null).new, [one]);
});

test('the same content under the same id is identical even when status and origin differ', () => {
  const shared = { id: 'STD-x', type: 'standard', title: 'A standard', body: 'one body' };
  const mine = item({ ...shared, status: 'active', origin: 'human' });
  const theirs = item({ ...shared, status: 'draft', origin: 'ingest' });

  assert.equal(bucketise([theirs], corpus(mine)).identical.length, 1);
});

test('a differing body is changed, and both short hashes are carried for the report', () => {
  const mine = item({ id: 'STD-x', body: 'ours' });
  const theirs = item({ id: 'STD-x', body: 'theirs' });

  const [c] = bucketise([theirs], corpus(mine)).changed;

  assert.equal(c.existing, mine);
  assert.equal(c.incoming, theirs);
  assert.equal(c.existingHash, itemContentHash(mine).slice(0, c.existingHash.length));
  assert.equal(c.incomingHash, itemContentHash(theirs).slice(0, c.incomingHash.length));
  assert.notEqual(c.existingHash, c.incomingHash);
  assert.deepEqual(c.differs, ['body']);
});

test('differs names exactly the fields that moved, in hashContent order', () => {
  const shared = { id: 'STD-x', type: 'standard', title: 'A standard', severity: 'soft' } as const;
  const existing = item({ ...shared, body: 'old', tags: ['b', 'a'] });
  const incoming = item({ ...shared, body: 'new', tags: ['a', 'b'], severity: 'hard' });

  // `tags` differs only in ORDER, which the hash sorts away, so it must not
  // be listed: a field named in the warning that did not move the hash would
  // teach the user to distrust the warning.
  assert.deepEqual(bucketise([incoming], corpus(existing)).changed[0].differs, ['body', 'severity']);
  assert.deepEqual(diffFields(existing, incoming), ['body', 'severity']);
});

test('a field cannot appear in differs without having moved the hash, and none can hide', () => {
  // The two directions of the same property, over every field the hash
  // composes: one at a time, moved, and then asserted BOTH ways round. The
  // field list is read off `diffFields` itself rather than retyped, so a
  // field added to the hash and forgotten here is not possible.
  const moves: readonly { field: string; move: (i: Item) => void }[] = [
    { field: 'type', move: (i) => { i.type = 'standard'; } },
    { field: 'title', move: (i) => { i.title = 'another title'; } },
    { field: 'body', move: (i) => { i.body = 'another body'; } },
    { field: 'steps', move: (i) => { i.steps = [{ text: 'a step', checked: false }]; } },
    { field: 'severity', move: (i) => { i.severity = 'hard'; } },
    { field: 'always', move: (i) => { i.always = true; } },
    { field: 'scope', move: (i) => { i.scope = ['src/**']; } },
    { field: 'tags', move: (i) => { i.tags = ['a-tag']; } },
    {
      field: 'observations',
      move: (i) => { i.observations = [{ category: 'evidence', text: 'x', tags: [], context: null }]; },
    },
    { field: 'relations', move: (i) => { i.relations = [{ type: 'supports', target: 'RULE-b' }]; } },
    { field: 'extra', move: (i) => { i.extra = { kind: 'prohibition' }; } },
  ];

  assert.deepEqual(
    moves.map((m) => m.field),
    diffFields(item(), (() => {
      const all = item();
      for (const m of moves) m.move(all);
      return all;
    })()),
    'every field the hash composes has a move above, in the hash\'s own order',
  );

  for (const { field, move } of moves) {
    const moved = item();
    move(moved);
    assert.deepEqual(diffFields(item(), moved), [field], field);
    assert.notEqual(itemContentHash(item()), itemContentHash(moved), field);
  }
});

test('an item differing only in observations is changed, and NOT overwritable', () => {
  const withoutObservation = item({ id: 'LESSON-x' });
  const withObservation = item({
    id: 'LESSON-x',
    observations: [{ category: 'evidence', text: 'seen once', tags: [], context: null }],
  });

  const [c] = bucketise([withObservation], corpus(withoutObservation)).changed;

  assert.deepEqual(c.differs, ['observations']);
  assert.equal(c.overwritable, false);
  assert.equal(c.blockedBy, 'observations');
});

// ---------------------------------------------------------------------------
// The text report
// ---------------------------------------------------------------------------

test('empty buckets still render, with their zero', () => {
  const lines = flat(renderCollisionReport(report()));
  for (const bucket of ['new', 'changed', 'identical']) {
    assert.match(lines, new RegExp(`${bucket}\\s+0`));
  }
});

test('ids render in UTF-8 byte order inside every bucket', () => {
  // `RULE-B` before `RULE-a` is the discriminating pair: a case-folding
  // comparator (localeCompare) puts them the other way round.
  const ids = ['N-b', 'N-B', 'N-a', 'C-b', 'C-B', 'C-a', 'I-b', 'I-B', 'I-a'];
  const here = ids
    .filter((id) => !id.startsWith('N-'))
    .map((id) => item({ id, title: id, body: id.startsWith('C-') ? 'ours' : 'shared' }));
  const incoming = ids.map((id) => item({
    id, title: id, body: id.startsWith('N-') || id.startsWith('C-') ? 'theirs' : 'shared',
  }));

  const lines = renderCollisionReport(report({ buckets: bucketise(incoming, corpus(...here)) }));

  for (const [bucket, prefix] of [['new', 'N-'], ['changed', 'C-'], ['identical', 'I-']]) {
    const rendered = renderedIds(lines, bucket);
    assert.deepEqual(
      rendered,
      ids.filter((id) => id.startsWith(prefix)).toSorted(comparePaths),
      bucket,
    );
  }
});

// ── §6n.7: the changed bucket IS the warning, so it is tested as one ──

test('every changed id appears in the rendered warning, with at least one field name', () => {
  // "Some items will be replaced" is a notice; §6n.7 requires a warning.
  const r = mixed();
  const text = flat(renderCollisionReport(r));

  assert.equal(r.buckets.changed.length, 2, 'the fixture must have something to warn about');
  for (const c of r.buckets.changed) {
    assert.ok(text.includes(c.incoming.id), c.incoming.id);
    assert.notEqual(c.differs.length, 0, `${c.incoming.id}: changed with no differing field`);
    for (const field of c.differs) assert.ok(text.includes(field), `${c.incoming.id}: ${field}`);
  }
});

test('an active item facing an overwrite is told it drops to draft; a draft one is not', () => {
  const here = corpus(
    item({ id: 'STD-active', type: 'standard', status: 'active', body: 'ours' }),
    item({ id: 'LESSON-draft', type: 'lesson', status: 'draft', body: 'ours' }),
  );
  const buckets = bucketise([
    item({ id: 'STD-active', type: 'standard', status: 'active', body: 'theirs' }),
    item({ id: 'LESSON-draft', type: 'lesson', status: 'draft', body: 'theirs' }),
  ], here);

  const text = flat(renderCollisionReport(report({ buckets })));

  assert.equal(buckets.changed.length, 2);
  assert.match(text, /stops governing until you promote it again/);
  assert.equal(
    (text.match(/stops governing/g) ?? []).length, 1, 'said once, for the active one only',
  );
});

test('the report never says a changed item is skipped unconditionally', () => {
  // The withdrawn design's own sentence. Asserted because this plan shipped
  // it in five places before §6n.7 withdrew it, and a §0 row does not stop a
  // renderer from being written from memory.
  const text = flat(renderCollisionReport(mixed()));
  assert.doesNotMatch(text, /NOT applied|never applied|will not be applied/);
});

// ---------------------------------------------------------------------------
// The json document
// ---------------------------------------------------------------------------

test('the json document carries every field the text does, in a fixed key order', () => {
  assert.deepEqual(Object.keys(collisionJson(mixed()) as object), [
    'pack', 'version', 'kind', 'source', 'format', 'manifest', 'buckets',
    'config', 'history', 'notCarried', 'refused', 'applied',
    'overwriteApproved', 'overwritten', 'loadErrors',
  ]);
});

test('overwriteApproved and overwritten are present on every path, including a dry run', () => {
  const doc = collisionJson(report()) as { overwriteApproved: unknown; overwritten: unknown };
  assert.equal(doc.overwriteApproved, false);
  assert.deepEqual(doc.overwritten, []);
});

test('a changed entry carries differs, existingStatus, overwritable and blockedBy', () => {
  const doc = collisionJson(mixed()) as {
    buckets: { changed: Record<string, unknown>[] };
  };
  assert.deepEqual(Object.keys(doc.buckets.changed[0]), [
    'id', 'type', 'title', 'existingHash', 'incomingHash',
    'differs', 'existingStatus', 'overwritable', 'blockedBy',
  ]);
});
