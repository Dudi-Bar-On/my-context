import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decoratePending, pendingRevisionViews, type RevisionRecord,
} from '../../src/core/revision-log.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { discardRevision, pendingRevisions, stageRevision } from '../../src/core/revision.ts';
import { sandbox } from '../helpers/workspace.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * The per-field staleness decoration, moved out of revision.ts (web-ui plan 2,
 * Task 1) so a surface that may not import a mutator can still render the
 * pending queue.
 *
 * The last two tests are the ones that make this a MOVE rather than a rewrite:
 * they stage through the real `stageRevision`, decorate through both paths and
 * compare. Tests may import revision.ts; only the SERVER graph may not.
 */

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'RULE-x',
    type: 'rule',
    title: 'Old title',
    status: 'active',
    severity: 'soft',
    always: false,
    continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [],
    tags: [],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    validFrom: null,
    validUntil: null,
    checksum: 'c',
    extra: {},
    body: 'Old body.',
    steps: [],
    observations: [],
    relations: [],
    layer: 'project',
    filePath: 'items/RULE-x.md',
    ...overrides,
  };
}

const record: RevisionRecord = {
  revisionId: 'REV-abc',
  itemId: 'RULE-x',
  changes: { title: 'New title' },
  base: { title: 'Old title' },
  origin: 'agent',
  stagedAt: '2026-08-01T00:00:00.000Z',
  state: 'pending',
  settledAt: null,
  reason: null,
};

test('a proposal whose base still matches the item is fresh', () => {
  const decorated = decoratePending(record, item());
  assert.deepEqual(decorated.current, { title: 'Old title' });
  assert.deepEqual(decorated.changedSince, []);
  assert.equal(decorated.stale, false);
  assert.equal(decorated.itemMissing, false);
});

test('a human edit to the very field the proposal rewrites makes it stale, per field', () => {
  const decorated = decoratePending(record, item({ title: 'Humanly changed' }));
  assert.deepEqual(decorated.changedSince, ['title']);
  assert.equal(decorated.stale, true);
  assert.deepEqual(decorated.current, { title: 'Humanly changed' });
  assert.equal(decorated.itemMissing, false);
});

test('an edit to a field the proposal does NOT touch leaves it fresh — staleness is per field', () => {
  const decorated = decoratePending(record, item({ body: 'A different body.' }));
  assert.deepEqual(decorated.changedSince, []);
  assert.equal(decorated.stale, false);
});

test('a missing item decorates as itemMissing with every field changed', () => {
  const decorated = decoratePending(record, null);
  assert.equal(decorated.itemMissing, true);
  assert.equal(decorated.stale, true);
  assert.deepEqual(decorated.changedSince, ['title']);
  assert.deepEqual(decorated.current, {});
});

test('tags compare as an unordered set — a reordering is not a change', () => {
  const tagRecord: RevisionRecord = {
    ...record,
    revisionId: 'REV-tags',
    changes: { tags: ['x', 'y', 'z'] },
    base: { tags: ['b', 'a'] },
  };
  const decorated = decoratePending(tagRecord, item({ tags: ['a', 'b'] }));
  assert.deepEqual(decorated.changedSince, []); // ['b','a'] vs ['a','b'] — same set
  assert.deepEqual(decorated.current, { tags: ['a', 'b'] });
});

test('a reordering of the same tags is not a change, but a different member is', () => {
  const tagRecord: RevisionRecord = {
    ...record,
    revisionId: 'REV-tags2',
    changes: { tags: ['x'] },
    base: { tags: ['b', 'a'] },
  };
  assert.deepEqual(decoratePending(tagRecord, item({ tags: ['a', 'c'] })).changedSince, ['tags']);
});

test('extra goes stale per KEY: a key the proposal never named does not make it stale', () => {
  const extraRecord: RevisionRecord = {
    ...record,
    revisionId: 'REV-extra',
    changes: { extra: { directive: 'do' } },
    base: { extra: { directive: 'dont' } },
  };
  const untouched = decoratePending(
    extraRecord,
    item({ extra: { directive: 'dont', kind: 'anything' } }),
  );
  assert.deepEqual(untouched.current, { extra: { directive: 'dont' } });
  assert.deepEqual(untouched.changedSince, []);

  const moved = decoratePending(extraRecord, item({ extra: { directive: 'maybe' } }));
  assert.deepEqual(moved.changedSince, ['extra']);
});

test('a key the proposal names and the item has not got yet is absent from current, and a human adding it goes stale', () => {
  const addRecord: RevisionRecord = {
    ...record,
    revisionId: 'REV-add',
    changes: { extra: { directive: 'do' } },
    base: { extra: {} },
  };
  assert.deepEqual(decoratePending(addRecord, item()).current, { extra: {} });
  assert.deepEqual(decoratePending(addRecord, item()).changedSince, []);
  assert.deepEqual(
    decoratePending(addRecord, item({ extra: { directive: 'someone got there first' } }))
      .changedSince,
    ['extra'],
  );
});

/**
 * `stageRevision` records a base for every field it stages, so a log it wrote
 * cannot reach this. A log line that predates a field joining
 * `REVISION_FIELDS` — `extra` joined late — or one edited by hand, can: the
 * proposal names a field its own base never recorded. The comparison is
 * one-sided-undefined there, and it reads as CHANGED, which is the only safe
 * answer. "The base did not say" is not "the base agreed", and treating it as
 * agreement would mark such a proposal fresh and let a promote overwrite text
 * nobody compared it against.
 */
test('a field the proposal names but its base never recorded reads as changed, not as agreed', () => {
  const noBase: RevisionRecord = {
    ...record, revisionId: 'REV-nobase', changes: { title: 'New title' }, base: {},
  };
  const decorated = decoratePending(noBase, item());
  assert.deepEqual(decorated.current, { title: 'Old title' });
  assert.deepEqual(decorated.changedSince, ['title']);
  assert.equal(decorated.stale, true);
});

test('changedSince keeps REVISION_FIELDS order, not the order the changes were written', () => {
  const many: RevisionRecord = {
    ...record,
    revisionId: 'REV-many',
    changes: { extra: { k: '1' }, tags: ['t'], body: 'b', title: 'T' },
    base: { extra: { k: 'was' }, tags: ['was'], body: 'other body', title: 'other title' },
  };
  // The item still carries none of the four base values, so all four moved.
  assert.deepEqual(
    decoratePending(many, item()).changedSince,
    ['title', 'body', 'tags', 'extra'],
  );
});

/**
 * The guard the move made necessary. `decorate` was private and had exactly one
 * caller, which filtered to `state === 'pending'` first; `decoratePending` is
 * exported for surfaces that hold a folded `RevisionRecord` of any state. Its
 * return type asserts `state: 'pending'`, so decorating a settled record would
 * hand a caller a promoted or discarded revision wearing the pending label —
 * "a discarded candidate came back pending", which is the exact failure
 * `foldLog`'s terminal-state rule exists to prevent.
 */
test('a settled record is refused, not relabelled pending', () => {
  for (const state of ['promoted', 'discarded'] as const) {
    const settled: RevisionRecord = {
      ...record, state, settledAt: '2026-08-02T00:00:00.000Z',
    };
    assert.throws(
      () => decoratePending(settled, item()),
      (err: Error) => {
        assert.match(err.message, new RegExp(`is ${state}, not pending`));
        assert.match(err.message, /REV-abc/);
        return true;
      },
    );
  }
});

test('pendingRevisionViews decorates an id that is in no item as missing', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'rule',
      title: 'Do not log customer email',
      body: 'Never log a customer email address, anywhere, at any level.',
      status: 'active',
      origin: 'human',
      severity: 'hard',
      always: false,
      continuity: false,
    }).id;
    stageRevision(box.ctx, id, { body: 'Avoid logging customer email addresses.' }, 'agent');

    const views = pendingRevisionViews(box.root, []);
    assert.equal(views.length, 1);
    assert.equal(views[0].itemMissing, true);
    assert.equal(views[0].stale, true);
    assert.deepEqual(views[0].changedSince, ['body']);
    assert.deepEqual(views[0].current, {});
  } finally { box.dispose(); }
});

/**
 * What stayed in `revision.ts` when the decoration left: the lookup. It has two
 * shapes — a `Store`, and, on the SessionStart injection path where the corpus
 * is already parsed and the database is off the critical path, `store: null`
 * with `items` supplied (`core/inject.ts` passes exactly that).
 *
 * This is pinned here because nothing else pins it. Mutating the delegation to
 * read the store alone — which is the body this task's plan told an implementer
 * to write — survived the whole suite: the one caller of the corpus-only shape
 * prints counts and ids, and reads none of the decorated fields, so every
 * revision silently decorating as `itemMissing` on that path costs nothing
 * observable *today*. It would cost the next reader of those fields everything.
 */
test('the delegation finds the item on the corpus-only context, not only through a store', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'rule',
      title: 'Do not log customer email',
      body: 'Never log a customer email address, anywhere, at any level.',
      status: 'active',
      origin: 'human',
      severity: 'hard',
      always: false,
      continuity: false,
    }).id;
    stageRevision(box.ctx, id, { body: 'Avoid logging customer email addresses.' }, 'agent');

    const items = box.ctx.store.all();
    const viaCorpus = pendingRevisions({
      root: box.root, store: null, items, config: box.ctx.config,
    });
    assert.equal(viaCorpus.length, 1);
    assert.equal(viaCorpus[0].itemMissing, false, 'the item is in `items`, so it is not missing');
    assert.equal(viaCorpus[0].stale, false);
    assert.deepEqual(viaCorpus, pendingRevisions(box.ctx));
  } finally { box.dispose(); }
});

test('pendingRevisionViews agrees with revision.ts pendingRevisions on a real staged log', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'rule',
      title: 'Do not log customer email',
      body: 'Never log a customer email address, anywhere, at any level.',
      status: 'active',
      origin: 'human',
      severity: 'hard',
      always: false,
      continuity: false,
    }).id;
    stageRevision(
      box.ctx, id, { body: 'Avoid logging customer email addresses unless necessary.' }, 'agent',
    );

    const fresh = pendingRevisions(box.ctx);
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0].stale, false);
    assert.deepEqual(pendingRevisionViews(box.root, box.ctx.store.all()), fresh);

    updateItem(box.ctx, { id, body: 'A human got here first.', origin: 'human' });

    const stale = pendingRevisions(box.ctx);
    assert.equal(stale.length, 1);
    assert.equal(stale[0].stale, true);
    assert.deepEqual(stale[0].changedSince, ['body']);
    assert.deepEqual(pendingRevisionViews(box.root, box.ctx.store.all()), stale);

    // A settled revision leaves both queues, and neither reaches the refusal:
    // the discard line is in the same log both of them fold, so a
    // pendingRevisionViews that stopped filtering would hand a discarded
    // record to `decoratePending` and throw here rather than return [].
    discardRevision(box.ctx, id, { revisionId: stale[0].revisionId });
    assert.deepEqual(pendingRevisions(box.ctx), []);
    assert.deepEqual(pendingRevisionViews(box.root, box.ctx.store.all()), []);
  } finally { box.dispose(); }
});
