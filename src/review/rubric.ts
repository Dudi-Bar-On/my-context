/**
 * **Whether a stretch of session is worth looking at** — `plan:loop seq:2`,
 * design §2's rubric.
 *
 * ── WHY A RUBRIC AND NOT A COUNTER ─────────────────────────────────────────
 *
 * A fixed-interval trigger is measured INFERIOR to a rubric-gated one: +6.3
 * points on BrowseComp at 30-70% lower token cost (arXiv:2606.23525), because
 * a fixed threshold "pays no heed to trajectory structure" and fires
 * mid-derivation. So `core/review-counter.ts` says *consider*; this says
 * whether there is anything here to consider.
 *
 * ── WHAT IT ACTUALLY RATIONS ON THIS CORPUS, MEASURED ──────────────────────
 *
 * Replayed by `scripts/review-trigger-replay.ts` over the owner's own session
 * transcript — 87,056,891 bytes, 36,448 records, **3,924 tool calls**,
 * 2026-09-10 — at §11's own `everyNToolCalls: 15`:
 *
 *     considerations                    261
 *     the rubric fires                  164   (62.8%)
 *     the rubric declines                97   (37.2%)
 *     passes that actually run            3   ← maxFiresPerSession
 *
 * **Two readings, and the second is the one to carry forward.**
 *
 * The rubric earns its place: **28 of the 97 refusals are "nothing in this
 * stretch"** — fifteen tool calls with not one admitted point in them, which is
 * mid-derivation exactly as arXiv:2606.23525 describes it — and 67 more are
 * measurements and questions with nothing that changed a rule. Those 97 are
 * model calls phase 3 will not make.
 *
 * But **the rubric is not the ration. `maxFiresPerSession` is**: 164 fires
 * collapse to 3. Anybody reading §2 as "the rubric keeps the volume down" is
 * reading it wrong on this corpus, and would be surprised the day the cap was
 * raised. The counterfactual is worth having beside it: firing on every `Stop`
 * would have been **766 passes in this one session** (its own `stop` rows in
 * the audit log), against 261 considerations and 3 passes.
 *
 * Re-run the script rather than trusting this block; a measurement that lives
 * only in a comment stops being true without anybody noticing.
 *
 * ── THE VOCABULARY IS THE READER'S, NOT THIS FILE'S ────────────────────────
 *
 * `category` is `PointCategory` from `core/session-summary.ts` — decision,
 * correction, measurement, question, failure. This module deliberately does
 * NOT import that type into its signature: the plan's interface takes a bare
 * `{ category: string; who: string }`, and widening it here would mean that
 * adding a sixth category to the reader silently made it a firing reason.
 * An unknown category is counted, named in the reason, and never fires alone.
 */

/** What the rubric decided, and why — the reason is never optional. */
export interface RubricVerdict {
  fire: boolean;
  /**
   * One sentence a person can act on.
   *
   * **Present on refusals too**, which is the half that is easy to drop and
   * the half that matters: a loop that declines and cannot say why is
   * indistinguishable from a loop that is broken, and this project has already
   * paid for that once (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).
   */
  because: string;
}

/** One thing the reader found, reduced to what the rubric reasons about. */
export interface RubricPoint {
  category: string;
  /** `person` or `model` in the reader's spelling. Anything else is "someone". */
  who: string;
}

/** The categories that make a stretch worth a pass on their own. */
const FIRES_ALONE = new Set(['decision', 'correction']);

/** The categories that count as a recovery when they come AFTER a failure. */
const RESOLVES = new Set(['decision', 'correction', 'measurement']);

/** Categories the reader produces that this rubric knows about. */
const KNOWN = new Set(['decision', 'correction', 'measurement', 'question', 'failure']);

/** How the reason names a speaker. */
function speaker(who: string): string {
  if (who === 'person' || who === 'OWNER') return 'the person';
  if (who === 'model') return 'the model';
  return 'someone';
}

/** `n thing(s)`, so a reason never reads "1 measurements". */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * Is this stretch worth a pass?
 *
 * ── THE THREE THINGS THAT FIRE, AND THE ONE THAT LOOKS LIKE THEM ───────────
 *
 *  - **A correction.** Design §4b: *"a correction that is lost is a mistake
 *    that will be made again"*. It fires whoever made it, and the reason says
 *    which — the owner correcting the assistant and the assistant correcting
 *    itself are not the same evidence (§3b), and phase 3 will need to weigh
 *    them differently.
 *  - **A decision.** The thing a transcript holds that the code does not.
 *  - **A failure THAT WAS THEN RESOLVED**, and the ordering is the whole of
 *    it. A `failure` with a recovery after it is the most expensive thing to
 *    rediscover; a `failure` with nothing after it is design §12's fifth
 *    anti-learning rule verbatim — *"if the session ended WITHOUT actually
 *    finding a working method… do NOT write those attempts up as a 'reliable
 *    workflow'"* — and it is refused here rather than left for a prompt to
 *    remember. A rubric that ignored order would call every failure in a busy
 *    stretch resolved by whatever happened to precede it.
 *
 * Measurements alone do not fire, and on this corpus that is the case that
 * carries the volume: measured 2026-09-10 over the owner's session, the reader
 * admits 668 measurement candidates against 12 failures. A trigger that fired
 * on measurement would be a trigger that fires on the reader's most abundant
 * category and calls it a signal.
 */
export function worthAPass(points: RubricPoint[]): RubricVerdict {
  if (points.length === 0) {
    return { fire: false, because: 'nothing in this stretch — the reader found no points at all' };
  }

  const counts = new Map<string, number>();
  for (const point of points) counts.set(point.category, (counts.get(point.category) ?? 0) + 1);

  // Fired-alone first, in the order the stretch produced them, so the reason
  // names the EARLIEST thing that made this worth reading rather than whatever
  // happened to be last.
  const trigger = points.find((point) => FIRES_ALONE.has(point.category));
  if (trigger !== undefined) {
    return {
      fire: true,
      because:
        `${plural(counts.get(trigger.category) ?? 1, trigger.category)} in this stretch, ` +
        `the first from ${speaker(trigger.who)}`,
    };
  }

  // A failure, and something after it. `findIndex` rather than a boolean pair,
  // because "after" is a position and a boolean cannot hold one.
  const failureAt = points.findIndex((point) => point.category === 'failure');
  if (failureAt !== -1) {
    const recovery = points.slice(failureAt + 1).find((point) => RESOLVES.has(point.category));
    if (recovery !== undefined) {
      return {
        fire: true,
        because:
          `a failure, then a ${recovery.category} after it — a failure that was resolved is ` +
          'the most expensive thing to rediscover',
      };
    }
    return {
      fire: false,
      because:
        `a failure with no recovery after it — unresolved, and §12's fifth rule refuses to ` +
        'learn from an untested sequence of attempts',
    };
  }

  const unknown = [...counts.keys()].filter((category) => !KNOWN.has(category));
  if (unknown.length > 0) {
    return {
      fire: false,
      because:
        `nothing that changed a rule: ${unknown.map((c) => `${plural(counts.get(c) ?? 0, c)}`).join(', ')} ` +
        '— a category this build does not know does not fire on its own',
    };
  }

  const said = [...counts.entries()].map(([category, n]) => plural(n, category)).join(', ');
  return {
    fire: false,
    because: `${said} and nothing that changed a rule — no decision, correction or resolved failure`,
  };
}
