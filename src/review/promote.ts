/**
 * **A promotion MOVES the file, because the boundary is the folder and not the
 * field** — `TASK-a-promoted-draft-is-never-moved-out-of-the-ignored-folder-so`.
 *
 * ── THE ONE FACT, WITH TWO SPELLINGS ───────────────────────────────────────
 *
 * `core/drafts.ts` already states the rule in its own words: *"promotion is a
 * MOVE plus a status flip rather than a migration."* Only the second half was
 * ever built. `review promote` called `updateItem(… status: 'active' …)` and
 * nothing anywhere moved the bytes, so an accepted item stayed at
 * `.drafts/<type>/<id>.md` — under a `.gitignore` that is a single `*`.
 *
 * The result is an item that is ACTIVE, INDEXED, GOVERNING and IN NO COMMIT.
 * It reaches no other machine and does not exist in a fresh clone, and because
 * the only thing that changed is a field inside an ignored file, `git status`
 * stays clean and nothing warns anybody. **Eight of the owner's items were in
 * that state on 2026-09-15**, found only because he said "nothing in queue
 * now" and the working tree disagreed by being empty.
 *
 * So: `status: draft` and "under `.drafts/`" are ONE fact written down twice,
 * and no act may change one without changing the other in the same act.
 * `declineDraft` has always honoured that — it deletes the file — and it is the
 * contrast that proves this half was missing rather than deliberate.
 *
 * ── WRITE THE NEW FILE FIRST, THEN REMOVE THE OLD ──────────────────────────
 *
 * The order is the whole of what happens if the process dies between the two,
 * and the two failures are not comparable:
 *
 *  - **New written, crash before the remove.** Two files carry one id.
 *    `loadLayer`'s per-layer duplicate check reports it, naming both paths, on
 *    the very next command. Loud, and every byte still exists.
 *  - **Old removed, crash before the new is written.** The item is GONE, and
 *    it was in no commit — that is the defect this module exists to end, so
 *    there is nothing to restore it from. Silent and unrecoverable.
 *
 * `declineDraft` makes the same choice for the same reason and states it as
 * "the survivable direction". This is that direction here.
 *
 * ── AND THE WRITE IS EXCLUSIVE ─────────────────────────────────────────────
 *
 * `persist(…, { exclusive: true })` creates the destination with a single
 * atomic operation that FAILS if the name is taken, which is the only check
 * that cannot be raced — a `existsSync` a line earlier answers about a moment
 * that is already over. A taken destination means some other item already
 * occupies `items/<type>/<id>.md`, and overwriting it would destroy a
 * committed corpus file to tidy up an uncommitted one. It is refused, the
 * draft is left exactly where it is, and the caller is told both paths.
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { isDraftFilePath } from '../core/drafts.ts';
import type { MutationContext } from '../core/mutate.ts';
import { persist } from '../core/persist.ts';
import type { Item } from '../core/types.ts';

/** Where a promoted item was, and where it now is. Both corpus-root-relative. */
export interface Relocation {
  from: string;
  to: string;
}

/** `Item.filePath` for a committed item — the shape `createItem` writes for
 *  every origin that is not `review`, respelled nowhere else. */
export function itemFilePath(type: string, id: string): string {
  return `items/${type}/${id}.md`;
}

/**
 * Move a just-promoted item out of the draft region, or `null` when there was
 * nothing to move.
 *
 * `null` rather than a throw for an item already under `items/`: `review
 * promote` is reachable for a draft a pack imported and for one the review
 * pass wrote, and only the second of those was ever in `.drafts/`. A caller
 * that promoted ten items wants to say what moved, not to special-case what
 * did not.
 *
 * **It refuses to move a draft that is still a draft.** The two halves of the
 * one fact move together or not at all, and a file under `items/` carrying
 * `status: draft` is the mirror image of the defect this closes — an
 * unreviewed proposal in the committed corpus, which is the thing `.drafts/`
 * exists to prevent (`core/drafts.ts`, design §4). Checked separately from the
 * path for `declineRefusal`'s stated reason: two guarantees that a build
 * satisfying one would otherwise look like it satisfied both.
 */
export function relocatePromotedDraft(ctx: MutationContext, item: Item): Relocation | null {
  if (!isDraftFilePath(item.filePath)) return null;
  if (item.status === 'draft') {
    throw new Error(
      `my_context: ${item.id} is still "draft", so its file is NOT moved out of the draft ` +
      `region. A draft under items/ would be an unreviewed proposal in the committed corpus, ` +
      `which is the thing .drafts/ exists to keep out of a clone. Promote it first.`,
    );
  }

  const from = item.filePath;
  const to = itemFilePath(item.type, item.id);
  const fromAbs = path.join(ctx.root, ...from.split('/'));

  // A COPY carrying the new path, rather than a mutation of the caller's item.
  // `Item.filePath` is readonly by design, and the reason bites exactly here:
  // if the write below fails there must be no object anywhere claiming
  // `items/…` for a file that is still in `.drafts/` — that is the same
  // divergence this function exists to end, pointing the other way.
  // `writeItem` resolves its target from this field and `persist` upserts the
  // object it was handed, so the file and the index row move together.
  const moving: Item = { ...item, filePath: to };
  try {
    persist(ctx, moving, { exclusive: true });
  } catch (err) {
    throw new Error(
      `my_context: ${item.id} was promoted to "${item.status}" but its file was NOT moved out ` +
      `of the gitignored draft region. It is still at ${from}, so it GOVERNS this project while ` +
      `existing on one machine only and in no commit. ${to} could not be written ` +
      `(${err instanceof Error ? err.message : String(err)}) — something already occupies that ` +
      `path, and overwriting a committed corpus file to tidy an uncommitted one is refused. ` +
      `Resolve the collision at ${to} and run the same command again.`,
    );
  }

  // Only now, and `force` because a destination that was written is worth more
  // than a source that will not unlink: the duplicate is visible and the
  // alternative would throw away the write that just succeeded.
  rmSync(fromAbs, { force: true });
  return { from, to };
}

/**
 * The sentence a surface says after a promotion moved a file.
 *
 * Its own function so the one-item path and `--all --pack` say it identically
 * — the promotion must DISCLOSE where the item now lives, and two spellings of
 * that disclosure would be two claims about one act.
 */
export function relocationSaid(moved: Relocation | null): string {
  if (moved === null) return '';
  return ` Its file moved from ${moved.from} to ${moved.to} — out of the region git ignores, ` +
    `so this promotion is a change you can commit and everyone else can clone.`;
}
