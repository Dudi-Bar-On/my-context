// @basis TASK-make-the-queue-workable-and-impossible-to-rot-unseen, INV-nothing-is-dropped-silently, TASK-declining-a-draft-deletes-it-even-when-the-decline-could-not
//
// §8: "A declined draft never governed, so nothing is stranded and no
// successor is owed. It is deleted." This is the only act in this product that
// deletes an item rather than retiring one, so what is asserted here is the
// BOUNDARY as much as the act: the origin, the region and the layer each
// refuse on their own, and each refusal is proved by removing one condition at
// a time rather than by asserting the happy path three ways.
//
// The order of the two writes is asserted too, through the crash direction: the
// ledger is written before the file is removed, so the survivable failure is
// "the owner declines it twice" rather than "the pass proposes it forever",
// which is the whole failure §8 exists about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createItem } from '../../src/core/mutate.ts';
import { alreadyDeclined, declinedPath, readDeclines, recordDecline } from '../../src/review/declined.ts';
import { declineDraft, declineRefusal } from '../../src/review/decline.ts';
import { claimKey } from '../../src/review/claim.ts';
import { reviewQueue } from '../../src/core/select.ts';
import { isDraftFilePath } from '../../src/core/drafts.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox } from '../helpers/workspace.ts';

const CLAIM = {
  title: 'scripts/gate-basis.ts admits a test file that declares no basis',
  body: 'Run npm run check:basis over test/review and the gate passes a file with no '
    + '@basis line at all, so the declaration it exists to require is optional in practice.',
};

/** A draft exactly as the review pass writes one — origin, region and all. */
function proposal(ctx: Parameters<typeof createItem>[0], scope: string[] = ['scripts/gate-basis.ts']): Item {
  const made = createItem(ctx, {
    type: 'task', title: CLAIM.title, summary: CLAIM.title.slice(0, 120), body: CLAIM.body,
    origin: 'review', tags: ['review-pass'], ...(scope.length === 0 ? {} : { scope }),
  });
  const item = ctx.store.get(made.id);
  assert.ok(item, 'the proposal must be in the index before anything declines it');
  return item;
}

test('a declined draft is deleted, and the decline survives it', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx);
    assert.ok(isDraftFilePath(draft.filePath), 'a review draft lands in the gitignored region');
    const file = path.join(s.root, ...draft.filePath.split('/'));
    assert.ok(existsSync(file));

    const result = declineDraft(s.ctx, draft, 'the gate is deliberately advisory');

    assert.equal(existsSync(file), false, 'a draft that never governed leaves no trail');
    assert.equal(s.ctx.store.get(draft.id), null, 'and it is out of the index, not merely off disk');
    assert.equal(reviewQueue(s.ctx.store.all()).length, 0, 'the queue is one shorter');

    const kept = readDeclines(s.root);
    assert.equal(kept.length, 1, 'what is kept is the DECLINE');
    assert.equal(kept[0]?.why, 'the gate is deliberately advisory');
    assert.equal(kept[0]?.target, 'scripts/gate-basis.ts');
    assert.equal(result.claim, kept[0]?.claim);
    assert.doesNotMatch(
      result.claim, /^[0-9a-f]{8,}$/,
      'the claim is a readable canonical value, never a digest — a ledger of hashes is one the ' +
      'owner cannot audit',
    );
  } finally {
    s.dispose();
  }
});

test('a reworded proposal of the same claim is already declined afterwards', () => {
  const s = sandbox();
  try {
    declineDraft(s.ctx, proposal(s.ctx), null);
    const reworded = claimKey(
      'the basis gate lets an undeclared test through',
      'Running npm run check:basis over test/review passes files declaring no @basis line, so '
      + 'the declaration the gate requires is optional in practice.',
      'scripts/gate-basis.ts',
    );
    assert.ok(
      alreadyDeclined(s.root, reworded, 'scripts/gate-basis.ts'),
      'a decline blocks the caller, not the call — the pass rephrases, and a content hash would '
      + 'give the same claim a second hearing every week',
    );
  } finally {
    s.dispose();
  }
});

test('the ledger is written before the file is removed, so the survivable crash is the cheap one', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx);
    const file = path.join(s.root, ...draft.filePath.split('/'));
    // The order is observable without a crash: a store that throws on delete
    // stops the act AFTER the ledger write and BEFORE nothing else. What must
    // never happen is a removed file with no decline on record.
    const original = s.ctx.store.deleteById.bind(s.ctx.store);
    (s.ctx.store as unknown as { deleteById: (id: string) => void }).deleteById = () => {
      throw new Error('index unavailable');
    };
    assert.throws(() => declineDraft(s.ctx, draft, 'why'), /index unavailable/);
    assert.equal(
      readDeclines(s.root).length, 1,
      'the decline is on record even though the act did not finish — the expensive failure is a ' +
      'deleted draft nobody remembers declining, and it is the one this order rules out',
    );
    assert.equal(existsSync(file), false);
    (s.ctx.store as unknown as { deleteById: (id: string) => void }).deleteById = original;
  } finally {
    s.dispose();
  }
});

test('only a review-pass draft is deleted — every other kind is refused, one condition at a time', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx);
    assert.equal(declineRefusal(draft), null, 'the real thing passes every condition');

    // Remove the origin, and nothing else.
    const human = { ...draft, origin: 'human' } as Item;
    assert.match(String(declineRefusal(human)), /written by "human"/);
    assert.match(
      String(declineRefusal(human)), /review discard/,
      'the refusal must name the act that IS right for it, or it reads as a dead end',
    );

    // Remove the region, and nothing else. The origin still passes, which is
    // the point: two guarantees, checked twice.
    const misplaced = { ...draft, filePath: 'items/task/TASK-x.md' } as Item;
    assert.match(String(declineRefusal(misplaced)), /outside the draft region/);

    // Remove the status.
    const active = { ...draft, status: 'active' } as Item;
    assert.match(String(declineRefusal(active)), /not "draft"/);

    // Remove the layer.
    const global = { ...draft, layer: 'global' } as Item;
    assert.match(String(declineRefusal(global)), /global layer/);

    // And the act itself refuses, not only the predicate — a caller that
    // forgot to ask must not get a deletion.
    assert.throws(() => declineDraft(s.ctx, human, null), /written by "human"/);
    assert.throws(() => declineDraft(s.ctx, misplaced, null), /outside the draft region/);
  } finally {
    s.dispose();
  }
});

test('a draft with no scope declines against a null target rather than refusing', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx, []);
    const result = declineDraft(s.ctx, draft, null);
    const kept = readDeclines(s.root);
    assert.equal(kept[0]?.target, null, 'a claim about a module or an id names no path');
    assert.ok(alreadyDeclined(s.root, result.claim, null));
    assert.equal(
      alreadyDeclined(s.root, result.claim, 'src/other.ts'), null,
      'and the same words about a different target are a different claim',
    );
  } finally {
    s.dispose();
  }
});


// ── plan:unread seq:1 — the ledger write is OBSERVED, and the delete waits on it ──
//
// The three tests below are one proposition split at the three places it can
// be broken, because a single end-to-end assertion would stay green if any one
// of them regressed on its own:
//
//   1. `recordDecline` can say it failed at all. It returned `void`, so no
//      caller could have asked. This is the observation point.
//   2. `declineDraft` reads that answer and refuses. The write-first ORDER
//      (asserted above) is worthless without this: a delete that runs anyway
//      reaches "draft gone, decline unrecorded" by the ordinary path, which
//      `decline.ts`'s own header calls "the whole of §8".
//   3. The refusal SAYS the ledger is why, and says the draft survived. A
//      refusal that does not is one a reader cannot act on.
//
// An unwritable ledger is produced by putting a DIRECTORY where the ledger
// file goes: `mkdirSync` and both `writeFileSync` calls still succeed and only
// the final `renameSync` fails, so what is exercised is a write that gets all
// the way to the last step — not a workspace that was never openable.

/** Make `state/review-declined.json` impossible to rename onto. */
function jamTheLedger(root: string): void {
  mkdirSync(declinedPath(root), { recursive: true });
}

test('recordDecline reports a ledger it could not write, rather than returning nothing', () => {
  const s = sandbox();
  try {
    const ok = recordDecline(s.root, { claim: 'a', target: null, at: '2026-01-01T00:00:00.000Z', why: null });
    assert.equal(ok.written, true, 'the happy path still reports success');
    assert.equal(ok.error, undefined, 'and carries no error when there was none');

    const s2 = sandbox();
    try {
      jamTheLedger(s2.root);
      const bad = recordDecline(s2.root, { claim: 'b', target: null, at: '2026-01-01T00:00:00.000Z', why: null });
      assert.equal(bad.written, false, 'a ledger that cannot be written says so');
      assert.match(
        String(bad.error), /review-declined\.json/,
        'and names the path, because "it failed" is not something a reader can fix',
      );
      assert.equal(readDeclines(s2.root).length, 0, 'nothing landed, which is the fact being reported');
    } finally {
      s2.dispose();
    }
  } finally {
    s.dispose();
  }
});

test('an unwritable ledger leaves the draft on disk, in the index and on the queue', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx);
    const file = path.join(s.root, ...draft.filePath.split('/'));
    assert.ok(existsSync(file));
    jamTheLedger(s.root);

    assert.throws(
      () => declineDraft(s.ctx, draft, 'the gate is deliberately advisory'),
      /is NOT declined/,
      'the act refuses rather than proceeding on an unrecorded decision',
    );

    assert.ok(existsSync(file), 'the draft file survives — deleting it would destroy the decision');
    assert.ok(s.ctx.store.get(draft.id), 'and it is still in the index, not merely still on disk');
    assert.equal(
      reviewQueue(s.ctx.store.all()).length, 1,
      'so the owner is asked again, which is the cheap failure decline.ts chose',
    );
    assert.equal(readDeclines(s.root).length, 0, 'and nothing claims to have been recorded');
  } finally {
    s.dispose();
  }
});

test('the refusal names the ledger, the error and the fact that nothing was deleted', () => {
  const s = sandbox();
  try {
    const draft = proposal(s.ctx);
    jamTheLedger(s.root);
    let message = '';
    try {
      declineDraft(s.ctx, draft, null);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    assert.notEqual(message, '', 'it must throw at all');
    assert.match(message, /review-declined\.json/, 'the reader is told WHICH write failed');
    assert.match(message, /EPERM|EACCES|EISDIR|ENOTDIR|EEXIST|ENOENT/, 'and the underlying errno is passed through, not swallowed');
    assert.match(message, /draft is NOT deleted|draft is untouched/, 'and that the draft survived');
    assert.match(message, /again/, 'and what to do next — a refusal with no way forward is a dead end');
  } finally {
    s.dispose();
  }
});
