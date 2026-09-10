/**
 * **Near-duplicate suppression, and it runs BEFORE anything reads a
 * proposal** — `plan:loop seq:3`, design §5b.
 *
 * ── WHY "BEFORE" IS THE WHOLE POINT ────────────────────────────────────────
 *
 * §5b: *"dedupe by target and near-duplicate similarity, before the pass is
 * invoked, and give it only the titles of what is already pending for the same
 * target. Bounded, and it does not depend on the model noticing."* The last
 * clause is the requirement. A prompt that asks a pass to avoid repeating
 * itself is a request; a gate the pass cannot see is a property. Upstream
 * measured what the request alone is worth: **13 firings, a 74-item queue, 29
 * patches to one skill.**
 *
 * ── EXACT AND FUZZY ARE COMPLEMENTARY, NOT ALTERNATIVES ────────────────────
 *
 * Content-hash dedupe catches the case that barely matters — two byte-identical
 * proposals. The case that produces a 74-item queue is two proposals that say
 * one thing in two ways, and a hash gate passes both (arXiv:2602.02007,
 * arXiv:2605.09611). `claim.ts` carries both layers and this module is the
 * policy over them: **target first, similarity second.**
 *
 * Target first is not an optimisation. It is an identity claim: the same
 * sentence about `styles.css` and about `app.js` is two observations, and
 * collapsing them would silently drop the second — the expensive direction,
 * because a suppressed proposal leaves no trace for anybody to notice.
 *
 * ── WHAT THIS MODULE IS NOT ────────────────────────────────────────────────
 *
 * It is not a queue and it holds no state. `pending` is handed in by the
 * caller. Whether that list comes from the draft store, from one pass's own
 * candidates, or from both is `propose.ts`'s decision, and the review queue
 * itself is `plan:loop seq:4`.
 */
import { claimKey, claimScore, sameClaim } from './claim.ts';

/**
 * One proposal that already exists — a draft on disk, or an earlier candidate
 * from this same pass.
 *
 * `target` is what the proposal is ABOUT: a repository path, an item id, or
 * `null` when it names neither. `null` is a real value and not a missing one
 * (STD-absent-vs-zero): a claim about nothing in particular can only be
 * compared with other claims about nothing in particular.
 */
export interface Pending {
  id: string;
  target: string | null;
  title: string;
  body: string;
}

/** Whether to drop `candidate`, and — when it is dropped — WHICH pending item it repeats. */
export interface Suppression {
  drop: boolean;
  /**
   * Names the pending id, the target and the score. Never a bare `true`:
   * a suppression nobody can trace is indistinguishable from a proposal that
   * was never made, and the two need different fixes.
   */
  because: string | null;
}

/**
 * Whether `candidate` repeats something already pending.
 *
 * Linear in `pending`, deliberately: the ration bounds a pass to a handful of
 * proposals and the draft store is bounded by the owner's review, so the list
 * this walks is tens of entries and not thousands. An index would be a second
 * structure to keep true.
 */
export function suppress(candidate: Pending, pending: readonly Pending[]): Suppression {
  const key = claimKey(candidate.title, candidate.body, candidate.target);
  if (key === '') {
    return { drop: false, because: null };
  }
  for (const prior of pending) {
    if (prior.id === candidate.id) continue;
    const priorKey = claimKey(prior.title, prior.body, prior.target);
    if (!sameClaim(key, priorKey)) continue;
    const score = key === priorKey ? 1 : claimScore(key, priorKey);
    const where = candidate.target === null ? 'no named target' : candidate.target;
    return {
      drop: true,
      because:
        `already pending as ${prior.id} ("${prior.title}") for ${where} — ` +
        `claim similarity ${score.toFixed(2)}`,
    };
  }
  return { drop: false, because: null };
}
