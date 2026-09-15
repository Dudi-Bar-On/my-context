// @basis TASK-a-promoted-draft-is-never-moved-out-of-the-ignored-folder-so, CONST-node-24-no-build-step
//
// **EVERY EXISTING PROMOTE TEST ASSERTS THE STATUS AND NONE ASSERTS THE
// LOCATION**, which is the whole reason eight of the owner's items reached
// `active` inside a gitignored folder with a green suite on 2026-09-15. So
// what is asserted here is the PATH, and the strongest spelling of it is not a
// path comparison at all: `git check-ignore` is asked whether git would carry
// the file, because that is the question the defect was actually about — an
// item that governs this project and exists in no commit, on one machine.
//
// A status assertion here would be the fixture carrying the proof's power all
// over again. `updateItem` has always flipped the field correctly; the field
// was never the half that was broken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { DRAFT_DIR, isDraftFilePath } from '../../src/core/drafts.ts';
import { itemFilePath, relocatePromotedDraft } from '../../src/review/promote.ts';
import { parseItem } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox } from '../helpers/workspace.ts';

const TITLE = 'the roster serves an unaccepted draft as a corpus item';
const BODY = 'Seven staged drafts nobody has accepted are served as if they were real items, '
  + 'and two rules in the same file disagree about whether that is allowed.';

/** A draft exactly as the review pass writes one — origin, region and all. */
function proposal(ctx: Parameters<typeof createItem>[0], title = TITLE): Item {
  const made = createItem(ctx, {
    type: 'task', title, summary: title.slice(0, 120), body: BODY,
    origin: 'review', tags: ['review-pass'], scope: ['src/ui/read-model.ts'],
  });
  const item = ctx.store.get(made.id);
  assert.ok(item, 'the proposal must be in the index before anything promotes it');
  return item;
}

/* ══ THE LOCATION, WHICH IS THE ASSERTION NOBODY MADE ══════════════════════ */

test('promoting a draft MOVES its file out of the draft region', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx);
    const wasAt = path.join(s.root, ...draft.filePath.split('/'));
    // ANTI-VACUITY: the premise of every assertion below is that a review
    // draft starts inside the ignored region. A run where it did not would
    // assert nothing about a move while passing.
    assert.ok(isDraftFilePath(draft.filePath), `the fixture draft is not in ${DRAFT_DIR}/`);
    assert.ok(existsSync(wasAt), 'the fixture draft has no file');

    updateItem(s.ctx, { id: draft.id, status: 'active', origin: 'human' });
    const moved = relocatePromotedDraft(s.ctx, s.ctx.store.get(draft.id) as Item);

    assert.notEqual(moved, null, 'a draft promotion reported nothing moved');
    assert.equal(moved!.from, draft.filePath);
    assert.equal(moved!.to, itemFilePath('task', draft.id));
    // The FILE, not the report: the old path is gone and the new one holds it.
    assert.equal(existsSync(wasAt), false, 'the draft file is still in the ignored region');
    const nowAt = path.join(s.root, ...moved!.to.split('/'));
    assert.ok(existsSync(nowAt), 'nothing was written at the committed path');

    // And the bytes are the item, not a stub: parsed back, it is the same id
    // with the status the promotion gave it.
    const onDisk = parseItem(readFileSync(nowAt, 'utf8'), moved!.to, 'project');
    assert.equal(onDisk.id, draft.id);
    assert.equal(onDisk.status, 'active');

    // The INDEX moved with the file. A row still naming `.drafts/…` would make
    // every reader built off `file_path` — the Library roster, `doctor`, the
    // corpus route — point at a file that is not there.
    assert.equal((s.ctx.store.get(draft.id) as Item).filePath, moved!.to);
  } finally {
    s.dispose();
  }
});

/**
 * **THE ASSERTION THE ITEM ASKED FOR, IN THE INSTRUMENT IT NAMED.**
 *
 * A path comparison proves the file is where this build decided to put it. It
 * does not prove the file is one git will carry, and that — not the folder
 * name — is what "active, governing, and in no commit" was about. So this runs
 * the real `git check-ignore` inside a real repository with the product's own
 * `.gitignore` files in place.
 *
 * It skips rather than fails where git is absent: a skipped guard that says
 * why is honest, and a guard that quietly passed because the fixture was never
 * built would not be.
 */
test('git check-ignore claims the draft and does NOT claim the promoted item', (t) => {
  const s = sandbox();
  try {
    try {
      execFileSync('git', ['init', '-q'], { cwd: s.cwd, stdio: 'ignore' });
    } catch (err) {
      t.skip(`git is not runnable here: ${String(err)}`);
      return;
    }
    // A repository that ignores nothing of its own, so the only ignore rule in
    // play is the `*` file the product itself writes into `.drafts/`.
    writeFileSync(path.join(s.cwd, '.gitignore'), '', 'utf8');

    /** Whether git would refuse to track this workspace-relative path. */
    const ignored = (rel: string): boolean => {
      try {
        execFileSync('git', ['check-ignore', '-q', '--', rel], { cwd: s.cwd, stdio: 'ignore' });
        return true;
      } catch { return false; }
    };

    const draft = proposal(s.ctx);
    const draftRel = path.posix.join('.my_context', draft.filePath);
    // ANTI-VACUITY, and it is the load-bearing half of this test: if git did
    // NOT ignore the draft, the assertion below would pass for a build that
    // moved nothing at all. The whole defect is the difference between these
    // two answers, so both are asserted.
    assert.equal(ignored(draftRel), true,
      `git does not ignore ${draftRel}, so this test cannot tell a move from a no-op`);

    updateItem(s.ctx, { id: draft.id, status: 'active', origin: 'human' });
    const moved = relocatePromotedDraft(s.ctx, s.ctx.store.get(draft.id) as Item);
    assert.notEqual(moved, null);

    const itemRel = path.posix.join('.my_context', moved!.to);
    assert.equal(ignored(itemRel), false,
      `${itemRel} is STILL ignored, so promoting it produced an item that governs this project ` +
      'and reaches no other machine');
  } finally {
    s.dispose();
  }
});

/* ══ THE REFUSALS, ONE REMOVED CONDITION AT A TIME ═════════════════════════ */

test('a draft that is STILL a draft is refused, not moved', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx);
    const wasAt = path.join(s.root, ...draft.filePath.split('/'));
    // The one condition removed is the status flip — everything else is the
    // passing case above.
    assert.throws(
      () => relocatePromotedDraft(s.ctx, draft),
      /is still "draft"/,
      'a draft was moved into the committed corpus without anybody accepting it',
    );
    assert.ok(existsSync(wasAt), 'the refusal moved the file anyway');
    assert.equal(existsSync(path.join(s.root, 'items', 'task', `${draft.id}.md`)), false);
  } finally {
    s.dispose();
  }
});

test('an item already under items/ reports nothing moved', () => {
  const s = sandbox();
  try {
    // `origin: 'human'` is the one condition changed: it is what sends a file
    // to `items/` instead of `.drafts/` (`createItem`), so this is the same
    // act on an item that was never in the draft region.
    const made = createItem(s.ctx, {
      type: 'task', title: 'a human wrote this one', summary: 'a human wrote this one',
      body: BODY, origin: 'human', status: 'active',
    });
    const item = s.ctx.store.get(made.id) as Item;
    assert.equal(isDraftFilePath(item.filePath), false, 'the fixture is in the draft region');
    assert.equal(relocatePromotedDraft(s.ctx, item), null,
      'an item that was never a draft reported a move');
    assert.ok(existsSync(path.join(s.root, ...item.filePath.split('/'))));
  } finally {
    s.dispose();
  }
});

/**
 * **A COLLISION DESTROYS NOTHING**, and the direction matters: the file being
 * protected is the COMMITTED one. Overwriting an item everybody has cloned in
 * order to tidy away an uncommitted draft would trade the recoverable failure
 * for the unrecoverable one.
 */
test('a destination that is already taken is refused, and the draft survives', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx);
    const to = itemFilePath('task', draft.id);
    const toAbs = path.join(s.root, ...to.split('/'));
    // Something else is already at the committed path. Written directly rather
    // than through `createItem`, because `createItem` would allocate the NEXT
    // id in the family and there would be no collision to refuse.
    mkdirSync(path.dirname(toAbs), { recursive: true });
    writeFileSync(toAbs, 'PRIOR CONTENT — must survive\n', 'utf8');

    updateItem(s.ctx, { id: draft.id, status: 'active', origin: 'human' });
    assert.throws(
      () => relocatePromotedDraft(s.ctx, s.ctx.store.get(draft.id) as Item),
      /was NOT moved out of the gitignored draft region/,
      'a taken destination was overwritten',
    );
    assert.equal(readFileSync(toAbs, 'utf8'), 'PRIOR CONTENT — must survive\n',
      'the committed file was overwritten to make room for a draft');
    assert.ok(existsSync(path.join(s.root, ...draft.filePath.split('/'))),
      'the draft was deleted even though its new home could not be written');
  } finally {
    s.dispose();
  }
});
