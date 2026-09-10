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
    });
  }
  return out;
}

/**
 * Append one decline, evicting the oldest first once `DECLINE_CAP` is reached.
 *
 * Written whole and atomically (temp file, rename) rather than appended: the
 * cap means a write is a rewrite anyway, and a torn append would leave a
 * half-line that `readDeclines` would drop — silently losing a decline the
 * owner made, which is the one record in this subsystem nobody can reconstruct.
 */
export function recordDecline(stateRoot: string, decline: Decline): void {
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
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* survivable litter */ }
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
