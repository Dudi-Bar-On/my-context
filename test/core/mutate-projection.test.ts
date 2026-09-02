/**
 * **The STORE half of the projection — `createItem` and `updateItem`**
 * (plan:categories seq 20).
 *
 * `mycontext edit` was closed at seq 15 and the store was not, so the drift the
 * plan exists to end could still be reintroduced through the surface the model
 * actually uses. Measured by execution on 2026-08-24, on a workspace declaring
 * `updates.state` with a `projectsTo`, before any line of this landed:
 *
 *     mycontext edit --state donee              REFUSED
 *     mycontext edit --extra state=donee        REFUSED
 *     mycontext add  --extra state=donee        EXIT 0, and the field written
 *     MCP update_item({extra:{state:'donee'}})  ACCEPTED, and returned "updated"
 *     MCP update_item({extra:{state:'done'}})   field written, `state:todo` left
 *
 * `updateItem` called `validateExtra` and `unknownExtraFieldError` and never
 * `updatableExtraError`, so a declared vocabulary was not enforced on that path
 * at all; `createItem` was the same. `doctor` reported every one of them
 * afterwards as `tag_projection_drift`, which is detection, not prevention.
 *
 * Two hazards are pinned here because both were found by running the code
 * rather than by reading it:
 *
 *  1. **`updateItem` merges `extra` but assigns `tags` OUTRIGHT.** Projecting
 *     from the STORED tag list and then letting `input.tags` overwrite the
 *     result silently eats the caller's list — measured landing an item with no
 *     projected tag at all. It must project from `input.tags ?? item.tags`.
 *  2. **The staged-revision path.** Under `agentEdits: "review"` an agent's
 *     update is STAGED, and the projected tags have to be staged WITH it.
 *     Measured before this landed: the revision carried `extra` alone, the diff
 *     a human approved showed only the field, and promoting it left the item
 *     with `state: done` and a `state:todo` tag — the same hole, one door
 *     further in.
 *
 * Every assertion here reads the FILE (or the revision log) rather than the
 * returned object: a message that says a value was refused is worth nothing if
 * the bytes moved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CategoryUpdates } from '../../src/core/categories.ts';
import { parseItem } from '../../src/core/item.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { pendingRevisions, promoteRevision } from '../../src/core/revision.ts';
import { projectFieldUpdate } from '../../src/core/tag-projection.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/**
 * The declaration, as a project writes it in `.my_context/config.json` — the
 * same one `test/cli/edit-projection.test.ts` drives the command with. `chore`
 * exists nowhere in `src/`, so a refusal that knows this vocabulary can only
 * have read it from the config.
 *
 * It was `task` until `task` shipped in the catalogue (2026-09-02). A SHIPPED
 * category resolves through the built-in branch of `resolveConfig`, where an
 * `updates` override EXTENDS the catalogue's declaration rather than being the
 * whole of it — so these fixtures would no longer have been the config's own
 * vocabulary and nothing else, which is the only thing they prove. `chore` is
 * the same declaration under a name the catalogue does not hold.
 */
const STATE = {
  store: 'field',
  values: ['todo', 'doing', 'blocked', 'done'],
  projectsTo: 'state',
  command: 'mycontext edit <id> --state <value>',
  note: 'Where this chore is.',
};

function config(
  updates: Record<string, unknown> = { state: STATE },
  category: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    profile: 'standard',
    categories: {
      chore: {
        tier: 'rationale',
        prefix: 'CHORE',
        description: 'A unit of planned work, tracked to completion.',
        extraFields: ['plan', 'seq', 'state'],
        updates,
        ...category,
      },
    },
  };
}

/** The item as it is ON DISK, reparsed — never the one in the index. */
function onDisk(box: Sandbox, id: string): Item {
  const rel = `items/chore/${id}.md`;
  return parseItem(readFileSync(path.join(box.root, ...rel.split('/')), 'utf8'), rel, 'project');
}

function fileExists(box: Sandbox, id: string): boolean {
  return existsSync(path.join(box.root, 'items', 'chore', `${id}.md`));
}

function withBox(rawConfig: Record<string, unknown>, fn: (box: Sandbox) => void): void {
  const box = sandbox(rawConfig);
  try {
    fn(box);
  } finally {
    box.dispose();
  }
}

// --- createItem -------------------------------------------------------------

test('createItem writes the projected tag for a declared field the caller never tagged', () => {
  withBox(config(), (box) => {
    const { id } = createItem(box.ctx, {
      type: 'chore', title: 'Captured legally', body: 'x', extra: { state: 'done' },
    });
    // Before this landed the item was born with the field and NO tag — `absent`
    // in `projectionMismatch`'s terms, and invisible to every filter that
    // groups by state from the moment of capture.
    assert.deepEqual(onDisk(box, id).tags, ['state:done']);
    assert.equal(onDisk(box, id).extra.state, 'done');
  });
});

test('createItem refuses a value outside the declared vocabulary and writes no file', () => {
  withBox(config(), (box) => {
    assert.throws(
      () => createItem(box.ctx, {
        type: 'chore', title: 'Captured with a typo', body: 'x', extra: { state: 'donee' },
      }),
      /"state" must be one of: todo, doing, blocked, done/,
    );
    // The refusal promises "Nothing was changed", and only the filesystem can
    // say whether that is true.
    assert.equal(fileExists(box, 'TASK-captured-with-a-typo'), false);
    assert.equal(box.ctx.store.get('TASK-captured-with-a-typo'), null);
  });
});

test('createItem reconciles a hand-written projected tag onto the caller\'s own list', () => {
  withBox(config(), (box) => {
    const { id } = createItem(box.ctx, {
      type: 'chore', title: 'Wire the projection', body: 'x',
      tags: ['plan:categories', 'state:todo', 'v2'],
      extra: { state: 'done', plan: 'categories' },
    });
    // The first tag under the prefix keeps its SLOT and takes the field's
    // value; every tag outside the prefix is where the caller put it.
    assert.deepEqual(onDisk(box, id).tags, ['plan:categories', 'state:done', 'v2']);
  });
});

test('createItem cannot capture a duplicate projected membership even by hand', () => {
  withBox(config(), (box) => {
    const { id } = createItem(box.ctx, {
      type: 'chore', title: 'Two memberships', body: 'x',
      tags: ['state:todo', 'state:doing'], extra: { state: 'done' },
    });
    assert.deepEqual(onDisk(box, id).tags, ['state:done']);
  });
});

/**
 * The projected tags are part of content identity (`ContentShape`,
 * content-hash.ts), so they have to be hashed as they will be STORED. Hashing
 * the caller's list and writing the projected one puts `createItem`'s dedup key
 * permanently out of step with disk: the second identical capture would mint a
 * second item instead of recognising itself.
 */
test('createItem hashes the projected tags, so an identical capture still dedupes', () => {
  withBox(config(), (box) => {
    const first = createItem(box.ctx, {
      type: 'chore', title: 'Same content', body: 'x', extra: { state: 'done' },
    });
    const second = createItem(box.ctx, {
      type: 'chore', title: 'Same content', body: 'x', extra: { state: 'done' },
    });
    assert.equal(second.created, false);
    assert.equal(second.id, first.id);
    assert.match(second.message, /already captured/);
  });
});

test('createItem leaves a category that declares no projection exactly as it was', () => {
  withBox(config({}), (box) => {
    const { id } = createItem(box.ctx, {
      type: 'chore', title: 'Undeclared', body: 'x',
      tags: ['v2'], extra: { state: 'anything at all' },
    });
    assert.deepEqual(onDisk(box, id).tags, ['v2']);
    assert.equal(onDisk(box, id).extra.state, 'anything at all');
  });
});

// --- updateItem, applied ----------------------------------------------------

/** One chore carrying both halves of the projection in agreement, plus two
 * unrelated tags — what every "the others survive" assertion is measured
 * against. */
function chore(box: Sandbox, extra: Record<string, string> = { state: 'todo', plan: 'categories' }): string {
  return createItem(box.ctx, {
    type: 'chore', title: 'Wire the projection', body: 'Call the seam.',
    tags: ['plan:categories', 'seq:20', 'state:todo', 'v2'],
    extra, origin: 'human',
  }).id;
}

test('updateItem moves the projected tag with the field it is generated from', () => {
  withBox(config(), (box) => {
    const id = chore(box);
    updateItem(box.ctx, { id, extra: { state: 'done' }, origin: 'human' });
    assert.deepEqual(onDisk(box, id).tags, ['plan:categories', 'seq:20', 'state:done', 'v2']);
    assert.equal(onDisk(box, id).extra.state, 'done');
  });
});

/**
 * **Hazard 1.** `updateItem` MERGES `extra` and ASSIGNS `tags`, so the
 * projection has to run over the INCOMING list. Measured before it did:
 * `{tags: ['v2','ui'], extra: {state: 'done'}}` landed `['v2','ui']` — the
 * field moved and the projected tag was gone from the item entirely.
 */
test('updateItem projects onto the caller\'s replacement tag list, not the stored one', () => {
  withBox(config(), (box) => {
    const id = chore(box);
    updateItem(box.ctx, { id, tags: ['v2', 'ui'], extra: { state: 'done' }, origin: 'human' });
    assert.deepEqual(onDisk(box, id).tags, ['v2', 'ui', 'state:done']);
  });
});

test('updateItem refuses a value outside the declared vocabulary and changes nothing on disk', () => {
  withBox(config(), (box) => {
    const id = chore(box);
    const before = readFileSync(path.join(box.root, 'items', 'chore', `${id}.md`), 'utf8');
    assert.throws(
      () => updateItem(box.ctx, { id, extra: { state: 'donee' }, origin: 'human' }),
      /"state" must be one of: todo, doing, blocked, done/,
    );
    assert.equal(readFileSync(path.join(box.root, 'items', 'chore', `${id}.md`), 'utf8'), before);
  });
});

/**
 * A declared vocabulary with NO projection is checked too. `rule.directive`
 * decides whether a rule prohibits or prescribes; there is no reading under
 * which a typo there should be accepted because the field happens not to be
 * filterable.
 */
test('updateItem refuses an undeclared value on a field that projects nothing', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'rule', title: 'Do not log customer email', body: 'Never.',
      origin: 'human', extra: { directive: 'dont' },
    }).id;
    assert.throws(
      () => updateItem(box.ctx, { id, extra: { directive: 'maybe' }, origin: 'human' }),
      /"directive" must be one of: do, dont/,
    );
    assert.equal(box.ctx.store.get(id)!.extra.directive, 'dont');
  } finally {
    box.dispose();
  }
});

/**
 * **This is not a migration.** `projectFieldUpdate` reconciles only the
 * projections whose field the CALLER is moving, so an edit that passes no
 * `extra` touches no tag — which is what leaves the already-disagreeing items
 * to seq 19 and its own audit trail.
 */
test('updateItem does not touch the tags of an item whose edit carries no extra', () => {
  // Captured while the category declared nothing, so the item is genuinely
  // drifted — a field and a tag naming different values, exactly the shape the
  // corpus measurement found fifteen of.
  const box = sandbox(config({}));
  try {
    const id = createItem(box.ctx, {
      type: 'chore', title: 'Already drifted', body: 'x',
      tags: ['state:todo', 'v2'], extra: { state: 'done' }, origin: 'human',
    }).id;
    // The declaration arrives afterwards, the way seq 14 authored it into a
    // config already full of items that predate it.
    box.ctx.config.categories.chore.updates = { state: STATE } as unknown as CategoryUpdates;

    updateItem(box.ctx, { id, title: 'Renamed, nothing else', origin: 'human' });

    assert.deepEqual(onDisk(box, id).tags, ['state:todo', 'v2']);
    assert.equal(onDisk(box, id).extra.state, 'done');
    assert.equal(onDisk(box, id).title, 'Renamed, nothing else');
  } finally {
    box.dispose();
  }
});

/**
 * The seq-15 wiring in `edit.ts` STAYS: the preview a human approves has to
 * show the tag rewrite as part of the diff, which means the command projects
 * before `changesOf` and the store projects again at the write. `reconcileTags`
 * is idempotent, so that is safe by construction — pinned here rather than
 * asserted in prose.
 */
test('projecting in the command and again in the store yields one tag, not two', () => {
  withBox(config(), (box) => {
    const id = chore(box);
    const item = box.ctx.store.get(id)!;
    const projected = projectFieldUpdate(box.ctx.config, item, { state: 'doing' });
    updateItem(box.ctx, { id, extra: projected.extra, tags: projected.tags, origin: 'human' });
    assert.deepEqual(onDisk(box, id).tags, ['plan:categories', 'seq:20', 'state:doing', 'v2']);
  });
});

// --- updateItem, staged (agentEdits: "review") ------------------------------

const REVIEWED = config({ state: STATE }, { agentEdits: 'review' });

/**
 * **Hazard 2, the one that was never checked.** The revision has to carry the
 * tags as well as the field, or the diff a human approves shows half the
 * change and promoting it lands the field without the tag.
 */
test('a staged revision carries the projected tags with the field', () => {
  withBox(REVIEWED, (box) => {
    const id = chore(box);
    const result = updateItem(box.ctx, { id, extra: { state: 'done' }, origin: 'agent' });

    assert.ok(result.staged, 'the update must have been staged, not applied');
    const [pending] = pendingRevisions(box.ctx);
    assert.deepEqual(pending.changes.extra, { state: 'done' });
    assert.deepEqual(pending.changes.tags, ['plan:categories', 'seq:20', 'state:done', 'v2']);
    // Staged means the item is untouched, in both halves.
    assert.deepEqual(onDisk(box, id).tags, ['plan:categories', 'seq:20', 'state:todo', 'v2']);
    assert.equal(onDisk(box, id).extra.state, 'todo');
  });
});

test('promoting that revision lands the field and the tag together', () => {
  withBox(REVIEWED, (box) => {
    const id = chore(box);
    updateItem(box.ctx, { id, extra: { state: 'done' }, origin: 'agent' });
    promoteRevision(box.ctx, id);
    assert.deepEqual(onDisk(box, id).tags, ['plan:categories', 'seq:20', 'state:done', 'v2']);
    assert.equal(onDisk(box, id).extra.state, 'done');
  });
});

test('an undeclared value is refused before it can be staged for a human to approve', () => {
  withBox(REVIEWED, (box) => {
    const id = chore(box);
    assert.throws(
      () => updateItem(box.ctx, { id, extra: { state: 'donee' }, origin: 'agent' }),
      /"state" must be one of: todo, doing, blocked, done/,
    );
    // Nothing pending: a typo laundered through the review gate arrives at a
    // human as a proposal to approve, which is worse than one that is merely
    // written.
    assert.deepEqual(pendingRevisions(box.ctx), []);
    assert.deepEqual(onDisk(box, id).tags, ['plan:categories', 'seq:20', 'state:todo', 'v2']);
  });
});

/**
 * The field is an ECHO and the tag is stale, so before this landed
 * `contentChange` saw no change, staged nothing, and returned "updated" while
 * the drift stayed. The tag rewrite is itself the proposal.
 */
test('an echoed field with a stale tag stages the tag rewrite rather than reporting a no-op', () => {
  const box = sandbox(config({}, { agentEdits: 'review' }));
  try {
    const id = createItem(box.ctx, {
      type: 'chore', title: 'Already drifted', body: 'x',
      tags: ['state:todo', 'v2'], extra: { state: 'done' }, origin: 'human',
    }).id;
    box.ctx.config.categories.chore.updates = { state: STATE } as unknown as CategoryUpdates;

    const result = updateItem(box.ctx, { id, extra: { state: 'done' }, origin: 'agent' });

    assert.ok(result.staged, 'the tag rewrite is a content change and must be staged');
    const [pending] = pendingRevisions(box.ctx);
    assert.deepEqual(pending.changes.tags, ['state:done', 'v2']);
    assert.equal(pending.changes.extra, undefined, 'the field itself did not move');
  } finally {
    box.dispose();
  }
});
