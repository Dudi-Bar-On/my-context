/**
 * **A decline is remembered by its CLAIM, not by its wording** — design §8.
 *
 * ── WHAT THIS PHASE OWNS AND WHAT IT DOES NOT ──────────────────────────────
 *
 * The Decline BUTTON is `plan:loop seq:4`. What is here is the half §8 puts on
 * the proposing side in as many words — *"the decline is appended to a ledger
 * and **the pass consults it before proposing**"* — because without the
 * consult the same transcript yields the same proposal forever, and that is a
 * defect in `plan:loop seq:3`'s output rather than in seq:4's screen.
 * `recordDecline` is here too, and only because `alreadyDeclined` cannot be
 * tested without it; the surface that CALLS it is seq:4's, and this module
 * takes no view on when a person declines anything.
 *
 * ── KEYED ON THE CLAIM ─────────────────────────────────────────────────────
 *
 * `claimKey` (claim.ts) is the canonical value, and that module carries the
 * reasoning and the limit. In one line: a content hash blocks one sentence and
 * the pass rephrases; a canonical claim blocks the caller rather than the call.
 *
 * ── THIS FILE IS UNTRUSTED INPUT, AND SO IS WHAT IT HOLDS ──────────────────
 *
 * **The ledger is text the pass reads on every run** (§8, arXiv:2608.21230).
 * It sits in a gitignored directory on a developer's machine; anything that
 * can write a file there can write a line into it. Three consequences, and all
 * three are implemented rather than merely noted:
 *
 *  1. **It is never rendered into a prompt as instructions.** `alreadyDeclined`
 *     answers a boolean-shaped question and nothing hands `why` to anything
 *     that could act on it.
 *  2. **It is bounded** (`DECLINE_CAP`). An unbounded ledger is a growing
 *     untrusted input read on every pass, which is a cost AND a surface.
 *  3. **A malformed record costs itself and never its neighbours** — the
 *     `jsonl-log.ts` posture. A ledger that throws on one bad line is a ledger
 *     one bad line disables, and a disabled decline ledger re-proposes
 *     everything the owner has already said no to.
 *
 * The failure direction is chosen deliberately: an unreadable ledger means the
 * pass proposes something it should not have, which the owner sees and
 * declines again. The opposite failure — trusting a ledger to suppress — would
 * let anything that can write the file silence a proposal permanently and
 * invisibly.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { claimKey, sameClaim } from './claim.ts';

export { claimKey };

/** One thing the owner said no to. */
export interface Decline {
  /** `claimKey(title, body, target)` — the canonical value, not the sentence. */
  claim: string;
  target: string | null;
  /** ISO 8601, UTC. Used only for eviction order. */
  at: string;
  /** The owner's reason, or `null`. **Read by people, never by the pass.** */
  why: string | null;
  /**
   * **The id the declined draft occupied** — an EXACT gate, and the half of
   * this ledger that does not decay. See `declinedFamily` below for why it
   * was added and what it catches that `claim` does not.
   *
   * Optional because every row written before this field existed has none,
   * and a ledger that dropped those rows would forget declines the owner
   * actually made. `null` and absent are the same thing and both mean "this
   * decline is remembered by its claim alone".
   */
  id?: string | null;
}

/**
 * The id family a declined draft belonged to — `TASK-x-2` and `TASK-x` are one
 * family, because `createItem` allocates `base`, `base-2`, `base-3`… into it
 * (`locateInFamily`, mutate.ts) and a re-proposal refused at `base` would
 * otherwise simply land at `base-2`.
 *
 * Measured on the owner's own state, 2026-09-15: he declined
 * `TASK-scripts-check-handover-ts-472-if-corpus-plans-has-plan` AND
 * `…-has-plan-2` inside ninety seconds — the same subject twice, one pass. A
 * gate on the literal id would have caught the first re-proposal and handed
 * the second one the suffix.
 */
export function declinedFamily(id: string): string {
  return id.replace(/-\d+$/, '');
}

/**
 * How many declines the ledger keeps.
 *
 * A number rather than a byte budget because the cost that matters is the
 * `sameClaim` sweep on every proposal, which is linear in entries and
 * indifferent to how long a `why` is. 500 is roughly two years of a decline a
 * working day, and at 24 tokens a key (`CLAIM_KEY_TOKENS`) the whole file is
 * well under 100 KB — small enough that a person can read it, which is the
 * property that matters for an untrusted input.
 */
export const DECLINE_CAP = 500;

/** `<stateRoot>/state/review-declined.json` — beside the pass report. */
export function declinedPath(stateRoot: string): string {
  return path.join(stateRoot, 'state', 'review-declined.json');
}

/**
 * Every decline on record, oldest first. `[]` for a workspace that has none,
 * for an unreadable file, and for a file that is not a list — see the header
 * for why all three degrade the same way.
 *
 * Every field is checked by TYPE and not trusted. A `claim` that arrived as a
 * number would compare equal to nothing and silently disable one entry; a
 * `claim` that arrived as an object would throw inside `overlapScore`.
 */
export function readDeclines(stateRoot: string): Decline[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(declinedPath(stateRoot), 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Decline[] = [];
  for (const row of parsed) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.claim !== 'string' || r.claim === '') continue;
    out.push({
      claim: r.claim,
      target: typeof r.target === 'string' ? r.target : null,
      at: typeof r.at === 'string' ? r.at : '',
      why: typeof r.why === 'string' ? r.why : null,
      // Type-checked like every field beside it, and for the same reason: an
      // `id` that arrived as a number would reach `declinedFamily`'s
      // `String.replace` and throw, which under this module's posture would
      // cost the whole ledger rather than the one row.
      id: typeof r.id === 'string' && r.id !== '' ? r.id : null,
    });
  }
  return out;
}

/**
 * What an append to the decline ledger did.
 *
 * Deliberately `AuditWriteResult`'s shape (`core/audit.ts`) rather than a new
 * one: both answer the same question - did the durable record land? - and a
 * caller that has learned to read one should not have to learn a second
 * spelling to read the other.
 *
 * It is RETURNED rather than thrown for `recordAudit`'s reason as well: what a
 * failed write MEANS belongs to the caller, and the callers want different
 * things. `declineDraft` must refuse to delete the draft; a surface that only
 * notes a decline may carry on and say so.
 */
export interface DeclineWriteResult {
  written: boolean;
  /** The failure, when `written` is false. Never swallowed - callers disclose it. */
  error?: string;
}

/**
 * Append one decline, evicting the oldest first once `DECLINE_CAP` is reached.
 *
 * Written whole and atomically (temp file, rename) rather than appended: the
 * cap means a write is a rewrite anyway, and a torn append would leave a
 * half-line that `readDeclines` would drop — silently losing a decline the
 * owner made, which is the one record in this subsystem nobody can reconstruct.
 *
 * **Whether it landed is RETURNED, and that is the repair of `plan:unread
 * seq:1`.** This returned `void`, so the one caller that deletes a file on the
 * strength of this write had no way to ask whether the write happened - and
 * deleted anyway. The `catch` below is unchanged and still never throws: the
 * posture stays the project's own KEEP FAILING OPEN, BUT DISCLOSE
 * (`KNOWN-an-unparseable-hook-payload-injects-plausibly-and-discloses`). What
 * changed is that the failure now has somewhere to be SEEN.
 */
export function recordDecline(stateRoot: string, decline: Decline): DeclineWriteResult {
  const kept = [...readDeclines(stateRoot), decline]
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    .slice(-DECLINE_CAP);
  const target = declinedPath(stateRoot);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    // `state/` may have no `.gitignore` yet on a workspace created before this
    // directory existed — the same three lines `ledger.ts`, `focus.ts` and
    // `session-names.ts` each write beside their own store, for the same
    // reason. A decline carries the owner's words about his own repository.
    writeFileSync(path.join(path.dirname(target), '.gitignore'), '*\n', 'utf8');
    writeFileSync(tmp, `${JSON.stringify(kept, null, 2)}\n`, 'utf8');
    renameSync(tmp, target);
    return { written: true };
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* survivable litter */ }
    return { written: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The decline this claim repeats, or `null`.
 *
 * `target` is taken as an argument as well as being inside `claim` so a caller
 * can ask the question without having built a key — but the comparison itself
 * is `sameClaim`'s, which gates on the target exactly. Passing a `target` that
 * disagrees with the one inside `claim` therefore cannot widen the match; it
 * is checked here so the disagreement is refused rather than ignored.
 */
export function alreadyDeclined(
  stateRoot: string, claim: string, target: string | null,
): Decline | null {
  if (claim === '') return null;
  for (const decline of readDeclines(stateRoot)) {
    if ((decline.target ?? null) !== (target ?? null)) continue;
    if (sameClaim(claim, decline.claim)) return decline;
  }
  return null;
}

/**
 * **The decline this proposal would re-create the FILE of, or `null`** —
 * `TASK-a-declined-claim-comes-back-when-a-later-pass-words-it`.
 *
 * ── WHY A SECOND GATE, WHEN `alreadyDeclined` EXISTS ───────────────────────
 *
 * Because the first one is a comparison of two keys that are DERIVED FROM
 * DIFFERENT TEXT, and nobody noticed. `propose.ts` builds its key from the
 * transcript observation (`claimKey(title, text, target)`); `declineDraft`
 * builds the stored key from the item's composed BODY, which begins with the
 * recommendation. `CLAIM_KEY_TOKENS` is 24 and tokens are taken in
 * first-occurrence order, so on the owner's own drafts the recommendation's
 * 382 characters exhaust the cap before a single token of the 1,377-character
 * brief is reached — measured 2026-09-15, `claimKey(title, WHOLE body)` came
 * back BYTE-IDENTICAL to `claimKey(title, recommendation half alone)`.
 *
 * So the ledger stores a key for the recommendation boilerplate and the pass
 * compares a key for the transcript. Two derivations, two answers — the exact
 * hazard `declineDraft`'s own comment names for the TARGET ("a second
 * derivation is a second answer"), sitting unguarded in the text beside it.
 * The measured consequence, twice on 2026-09-15 and a third time at 10:57Z:
 * the owner declined a draft and the next pass re-created it at the SAME
 * FILENAME, scoring 0.277 and 0.310 against a threshold of 0.35.
 *
 * ── SO THIS GATE IS EXACT, AND DELIBERATELY NARROW ─────────────────────────
 *
 * It asks one question with no threshold in it: **would this proposal be
 * written to a filename a person already declined?** An id is
 * `makeId(prefix, title)` and a title is a clip of the claim sentence, so two
 * proposals selecting the same sentence about the same subject slug
 * identically however differently the surrounding prose reads. All three of
 * the owner's re-proposals did exactly that.
 *
 * **What it does NOT catch is stated rather than implied**: the same claim
 * found in a different session and expressed in a different sentence slugs
 * differently and passes. That is left to `alreadyDeclined`, and the failure
 * direction is the cheap one — the owner sees a proposal he has seen before
 * and declines it again, which costs one reading. `NEAR_CLAIM_THRESHOLD` is
 * deliberately NOT moved to close the gap: on two pairs there is no
 * distribution to move it against, and suppressing a genuinely new claim is
 * the expensive direction — the owner never sees it and nothing tells him.
 * The 0.593/0.645 "same-pass" band that looks like headroom is boilerplate
 * overlap between two recommendation texts, not subject overlap, so lowering
 * the cutoff toward it would start suppressing NEW claims about a target
 * whenever the pass gave them the same recommendation reason.
 *
 * ── AND IT IS GATED ON THE TARGET, EXACTLY AS `sameClaim` IS ──────────────
 *
 * An id carries no target — `TASK-the-roster-serves-drafts` says nothing about
 * which file it is about — and `slugify` truncates at 60 characters, so two
 * genuinely different long claim sentences can cut to one slug (`slug.ts` says
 * so in as many words). The target gate is what makes that collision harmless:
 * the same 60-character slug AND the same target is one claim, and §5b's own
 * example — *"the same words about a different target"* — stays two.
 *
 * ── MATCHED ON THE SLUG, NOT ON THE WHOLE ID, AND WHY THAT IS NOT WIDER ────
 *
 * The caller knows the TITLE at the moment the gate is asked and does not yet
 * know the artifact, so it does not yet know which category prefix
 * `createItem` will mint under. Comparing the slug half — `endsWith` against
 * the declined id — asks the same question without reordering the screens
 * around it, and the only case it additionally catches is the same claim
 * sentence about the same target re-proposed as a different TYPE, which is the
 * same proposal re-typed rather than a new one.
 */
export function declinedAtSameId(
  stateRoot: string, slug: string, target: string | null,
): Decline | null {
  if (slug === '') return null;
  // Both sides are reduced to the family, so `TASK-x` and `TASK-x-2` are one
  // name. A title that genuinely ends in a number loses it on BOTH sides and
  // therefore still compares equal to itself — the collapse is symmetric, and
  // the target gate above is what keeps it from reaching a different claim.
  const want = declinedFamily(slug);
  for (const decline of readDeclines(stateRoot)) {
    if ((decline.target ?? null) !== (target ?? null)) continue;
    const was = decline.id ?? null;
    if (was === null) continue;
    const had = declinedFamily(was);
    if (had === want || had.endsWith(`-${want}`)) return decline;
  }
  return null;
}
