/**
 * **Decline: the draft is deleted and the decline is kept** — `plan:loop
 * seq:4`, design §8.
 *
 * ── THE ONE ACT IN THIS PRODUCT THAT DELETES AN ITEM ───────────────────────
 *
 * Everything else retires. `review discard` on a human's draft sets
 * `deprecated` and says *"it is kept as a trail rather than deleted"*;
 * `supersede` keeps the retired text and names its successor. That posture is
 * right for anything that ever governed, and §8 says plainly why it does not
 * apply here: **"A declined draft never governed, so nothing is stranded and
 * no successor is owed. It is deleted."**
 *
 * What is kept instead is the DECLINE — `declined.ts`'s ledger, keyed on the
 * canonical claim — because the failure §8 is actually about is not a lost
 * draft, it is the same transcript yielding the same proposal forever. A trail
 * of deprecated agent drafts would answer neither: it would neither stop the
 * re-proposal (the pass does not read the corpus for that) nor be worth
 * reading (nobody reads a retired draft nobody wrote).
 *
 * ── THE BOUNDARY IS `origin: 'review'`, AND SO IS EVERY REFUSAL BELOW ──────
 *
 * `plan:loop seq:3` made that origin the trust boundary in three places at
 * once — `trustedStatus` forces `draft`, `updateItem` and `supersedeItem`
 * refuse it outright, and `core/drafts.ts` sends its file to a gitignored
 * region. This module adds the fourth and it is the same boundary, not a new
 * one: **only a `review`-origin draft, in the `.drafts/` region, in the
 * project layer, may be deleted.** An ingest draft, a human draft, a promoted
 * item and a global-layer anything are all refused, and the refusal names
 * `review discard` — which retires them, correctly, and is not this act.
 *
 * The two conditions are checked SEPARATELY rather than as one, because they
 * are two different guarantees and a build that satisfied one would otherwise
 * look like it satisfied both. The origin says who wrote it; the path says
 * whether deleting it can touch anything git tracks. A `review`-origin item
 * that had somehow been written under `items/` is refused by the second check
 * precisely because the first one passed.
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { isDraftFilePath } from '../core/drafts.ts';
import { auditMutation } from '../core/persist.ts';
import type { MutationContext } from '../core/mutate.ts';
import type { Item } from '../core/types.ts';
import { claimKey } from './claim.ts';
import { recordDecline } from './declined.ts';

/** What a decline did, for the surface that has to say it. */
export interface DeclineResult {
  /** The canonical claim now on record. Readable, never a digest — see `claim.ts`. */
  claim: string;
  /** The file that is gone, corpus-root-relative. */
  filePath: string;
  /** The audit note `auditMutation` produced, or `''`. */
  audit: string;
}

/**
 * Whether this item may be declined, or the sentence saying why not.
 *
 * Exported and called by the surface BEFORE it asks a human to confirm
 * anything: a refusal that arrives after "are you sure?" is a refusal the
 * reader has already been asked to approve. Same ordering rule
 * `cli/commands/review.ts` states for its own preview.
 */
export function declineRefusal(item: Item): string | null {
  if (item.status !== 'draft') {
    return `my_context: ${item.id} is "${item.status}", not "draft". Only a draft can be ` +
      `declined — an item that already governs is retired with \`mycontext supersede\` so its ` +
      `text survives as a trail.`;
  }
  if (item.layer !== 'project') {
    return `my_context: ${item.id} belongs to the global layer and cannot be declined from this ` +
      `project — global items are read-only here.`;
  }
  if (item.origin !== 'review') {
    return `my_context: ${item.id} was written by "${item.origin}", not by the review pass, so ` +
      `it is not deleted. \`mycontext review discard ${item.id}\` retires it instead and keeps ` +
      `it as a trail — which is right for a draft a person or an ingest wrote, and is why the ` +
      `two acts are not the same command doing different things by accident.`;
  }
  if (!isDraftFilePath(item.filePath)) {
    return `my_context: ${item.id} claims origin "review" but its file is ${item.filePath}, ` +
      `which is outside the draft region. It is refused rather than deleted: the delete is ` +
      `safe only because a draft's file is gitignored working state, and that guarantee comes ` +
      `from the PATH, not from the origin field.`;
  }
  return null;
}

/**
 * Delete the draft, keep the decline.
 *
 * **The ledger is written BEFORE the file is removed**, and the order is the
 * one property that matters if the process dies between the two. Written
 * first, a crash leaves a decline on record for a draft that still exists —
 * the owner sees it once more and declines it again, which costs one reading.
 * Removed first, a crash leaves the draft gone and the decline unrecorded, and
 * the next pass proposes the same claim forever with nothing to stop it. **The
 * whole of §8 is that second failure**, so the write that prevents it goes
 * first.
 *
 * `why` is the owner's own words and is stored for PEOPLE. Nothing hands it to
 * the pass — `declined.ts` says so in its header, and the reason is that the
 * ledger is untrusted input the pass reads on every run.
 */
export function declineDraft(
  ctx: MutationContext, item: Item, why: string | null, now: Date = new Date(),
): DeclineResult {
  const refusal = declineRefusal(item);
  if (refusal !== null) throw new Error(refusal);

  // The target the claim is ABOUT. A review draft carries it as its scope —
  // `propose.ts` writes `scope: [target]` for any target with a path
  // separator in it — and `null` where it named a module or an item id
  // instead. Taken from the item rather than re-derived from its text: the
  // claim key the pass will compare against was built from this same value,
  // and a second derivation is a second answer.
  const target = item.scope.length > 0 ? (item.scope[0] ?? null) : null;
  const claim = claimKey(item.title, item.body, target);
  recordDecline(ctx.root, { claim, target, at: now.toISOString(), why });

  rmSync(path.join(ctx.root, ...item.filePath.split('/')), { force: true });
  ctx.store.deleteById(item.id);

  // `discard` rather than a new op: this IS the discard verb — the item is
  // settled and gone from the queue — and a new `MUTATION_OPS` entry would
  // make every existing reader of that log (`mycontext audit --op discard`,
  // the export filter, the statusline's last-audit clock) blind to the one
  // settlement this loop performs most. The NOTE is where the difference is
  // recorded, because the difference is real: this row's item cannot be
  // fetched afterwards.
  const audit = auditMutation(ctx, 'discard', 'human', item.id, {
    note: `declined and deleted — a review-pass draft that never governed. The claim is kept ` +
      `in the decline ledger so the pass does not re-propose it` +
      (why === null ? '.' : `: ${why}`),
  });

  return { claim, filePath: item.filePath, audit };
}
