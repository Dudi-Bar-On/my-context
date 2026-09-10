/**
 * **What a proposal is ABOUT, reduced to a value two proposals can be compared
 * on** — `plan:loop seq:3`, design §5b (dedupe) and §8 (decline).
 *
 * ── WHY THIS IS NOT A CONTENT HASH ─────────────────────────────────────────
 *
 * §8 is blunt: *"A content hash blocks one sentence; the pass rephrases and
 * re-proposes… It is the difference between blocking a phone number and
 * blocking a caller."* Every prior-art system that remembers a rejection keys
 * it on a canonical value or label, and the reason is mechanical rather than
 * stylistic — a hash is maximally sensitive to exactly the thing a regenerated
 * proposal changes most (wording) and completely blind to the thing it changes
 * least (subject).
 *
 * So the key is a CANONICAL VALUE and not a digest, in two layers, because
 * exact and fuzzy dedupe are complementary and not substitutes
 * (arXiv:2602.02007, arXiv:2605.09611):
 *
 *  1. `claimKey` normalises a claim to a sorted, stemmed, stopword-free token
 *     string. Two claims that differ only in word order, casing, punctuation,
 *     markdown, inflection, a date, a ticket id or filler produce the SAME
 *     string. That is the exact layer, and it is deterministic.
 *  2. `sameClaim` compares two of those canonical strings with `overlapScore`
 *     at `NEAR_CLAIM_THRESHOLD`. That is the fuzzy layer, and it is what
 *     survives a genuine re-write.
 *
 * **It is a readable string and never a digest, deliberately.** The decline
 * ledger is text the pass reads back — §8 calls it a poisoning surface — and a
 * ledger of opaque hashes is one the owner cannot audit. A ledger of
 * `chrome console dark input render styl` lines is one he can read in ten
 * seconds and delete a line from.
 *
 * ── AND THE LIMIT, WHICH IS REAL ───────────────────────────────────────────
 *
 * Neither layer resists genuine SYNONYM substitution. "a bare input renders as
 * browser chrome" and "an unstyled field shows user-agent decoration" share
 * almost no stems, and nothing here has a thesaurus
 * (`CONST-zero-runtime-dependencies` — and a bundled one would be a
 * vocabulary, not a meaning). What this resists is a pass RE-EXPRESSING
 * itself, which is the observed failure; what it does not resist is a pass
 * that has genuinely thought of new words. That gap is the reason §8's ledger
 * is bounded and consulted rather than trusted, and the reason the owner sees
 * the proposal at all.
 */
import { overlapScore } from '../core/overlap.ts';

/**
 * Words that carry no subject. Deliberately short and closed: a long stoplist
 * starts deciding which technical words matter, and the failure mode of
 * dropping a content word is two different claims collapsing into one key —
 * a proposal silently suppressed, which is the expensive direction.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'was', 'were', 'are', 'but', 'not',
  'you', 'your', 'our', 'its', 'it', 'is', 'be', 'been', 'has', 'have', 'had', 'can', 'will',
  'would', 'should', 'could', 'when', 'what', 'which', 'who', 'why', 'how', 'into', 'onto',
  'than', 'then', 'they', 'them', 'there', 'here', 'because', 'about', 'over', 'under',
  'one', 'two', 'all', 'any', 'some', 'each', 'per', 'via', 'out', 'off', 'now', 'very',
  'just', 'only', 'also', 'more', 'most', 'less', 'own', 'same', 'other', 'such', 'both',
]);

/**
 * A DATE and a TICKET ID are stripped before tokenising, not stoplisted after.
 *
 * §12's shape contract forbids both as CONTENT — *"no ticket ids, dates or
 * quoted user text as content"* — and the reason bites hardest right here: a
 * claim carrying `2026-09-08` is a claim whose key changes tomorrow, so the
 * same observation made twice a day apart would look like two claims and be
 * proposed twice. Stripping them is what makes the key stable across the only
 * axis a re-observation is guaranteed to move along.
 */
const DATE_OR_TICKET = /\b\d{4}-\d{2}-\d{2}\b|#\d+\b|\bv?\d+\.\d+(?:\.\d+)*\b/g;

/** Markdown and quotation that decorate rather than say anything. */
const DECORATION = /[`*_~>[\]()"'‘’“”]/g;

/**
 * Very light suffix stripping — plural, past, gerund. **Not a stemmer**, and
 * the difference matters: a real stemmer conflates `check` and `checkable`,
 * and this loop's entire artifact order turns on that distinction (design §4).
 * Four suffixes, applied once, only to tokens long enough that removing one
 * leaves a word.
 */
function stem(token: string): string {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/**
 * How many tokens a key may carry.
 *
 * Bounded because a claim key is stored in a ledger the pass reads on every
 * run, and because containment (`overlapScore`'s second half) measures LENGTH
 * as much as subject once one side is long — `overlap.ts` records that
 * property costing 72 of 82 corpus pairs their meaning. A cap keeps every key
 * roughly the same size, which is what makes comparing two of them a
 * comparison of subjects.
 *
 * Taken in FIRST-OCCURRENCE order and sorted afterwards: sorting first and
 * then capping would keep the alphabetically early tokens, which is a bias
 * toward whatever the claim happens to start its vocabulary with rather than
 * toward what it is about.
 */
export const CLAIM_KEY_TOKENS = 24;

/**
 * The canonical value for one claim: lowercase, decoration-free, date- and
 * ticket-free, stopword-free, lightly stemmed, deduplicated, capped and
 * sorted. Prefixed with the target when there is one, because the target is
 * part of the claim's identity and not a filter over it (§5b: *"the same words
 * about a different target"* are a different claim).
 *
 * Empty input produces `''`, and `sameClaim` treats `''` as matching nothing —
 * a claim with no content words is not a claim two of anything.
 */
export function claimKey(title: string, body: string, target: string | null): string {
  const text = `${title}\n${body}`
    .toLowerCase()
    .replace(DATE_OR_TICKET, ' ')
    .replace(DECORATION, ' ');

  const seen = new Set<string>();
  for (const raw of text.split(/[^a-z0-9_./\\-]+/)) {
    if (raw === '') continue;
    const token = stem(raw.replace(/^[-._/\\]+|[-._/\\]+$/g, ''));
    if (token.length < 3 || STOPWORDS.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    seen.add(token);
    if (seen.size >= CLAIM_KEY_TOKENS) break;
  }

  const words = [...seen].sort().join(' ');
  const subject = target === null || target === '' ? '' : `${target.toLowerCase()} :: `;
  return words === '' ? '' : `${subject}${words}`;
}

/**
 * **Calibrated on this repository's own pass output, not chosen.**
 *
 * Method: `gather()` over the owner's real session directory on 2026-09-11 —
 * 292 sources, 841,502,108 bytes, 158,706 records, 1,282 observations — put
 * through `propose.ts`'s screens up to the point of dedupe, giving **363
 * candidates** and **245 pairs that share a target** (a pair with different
 * targets scores 0 by construction, below). Every one of those 245 was scored:
 *
 *   cutoff   pairs suppressed   of 245   what the sampled pairs were
 *   0.20          104           42.4%    different subjects, same vocabulary
 *   0.25           71           29.0%    mostly different
 *   0.30           52           21.2%    mixed
 *   0.35           34           13.9%    same subject
 *   0.40           27           11.0%    same subject
 *   0.45           17            6.9%    same subject
 *   0.50            6            2.4%    near-identical only
 *
 * **0.35**, and the number was read off the TEXT rather than off the
 * percentages. Two things decided it:
 *
 *  - Between 0.35 and 0.40 sit three pairs that are unambiguously one claim,
 *    including two candidates whose whole sentence is `node src/cli/index.ts
 *    doctor:` (0.385) and a third reading `node src/cli/index.ts doctor → 0
 *    errors, 2 warnings.` (0.369). **A cutoff at 0.40 lets two runs of the
 *    same command become two proposals**, which is the exact growth path §5b
 *    exists to close.
 *  - Below 0.35 the sampled pairs stop being one claim: at 0.320, one
 *    candidate is about `forgetConversations` and the other is a list of files
 *    a change touched. Both name `src/core/conversation-index.ts`, and they
 *    are not the same observation.
 *
 * It is NOT `CONTRADICTION_THRESHOLD` and must not be replaced by it. That
 * number answers a different question (does this contradict) over a different
 * population (whole item bodies, median 162 tokens) on unnormalised text. This
 * one is over canonical keys capped at `CLAIM_KEY_TOKENS` stemmed tokens,
 * where the stopword and inflection noise that forced 0.45 there is already
 * gone — which is why the calibrated answer here is LOWER rather than higher.
 *
 * A calibration, not a ruling: the number is the owner's to confirm, the table
 * above is what it was chosen from, and re-running a dry-run pass over a later
 * session is how it is re-derived when the corpus and the transcripts grow.
 */
export const NEAR_CLAIM_THRESHOLD = 0.35;

/** The separator between a key's target half and its word half. */
const SUBJECT_SEP = ' :: ';

/** `[target, words]` for a key. `target` is `''` when the claim named none. */
function split(key: string): [string, string] {
  const at = key.indexOf(SUBJECT_SEP);
  return at === -1 ? ['', key] : [key.slice(0, at), key.slice(at + SUBJECT_SEP.length)];
}

/**
 * Whether two canonical claim keys say the same thing. `''` matches nothing.
 *
 * **The target is an EXACT gate and never a token.** It is inside the key so
 * that a key is self-describing in the ledger, but comparing the whole string
 * fuzzily was measured wrong on the design's own example: `styles.css` and
 * `app.js` differ by two tokens out of ten, so *"the same words about a
 * different target"* scored 0.83 and would have been suppressed — the exact
 * case §5b names as the one that must NOT be. Splitting first costs one
 * `indexOf` and makes the target's contribution total instead of fractional.
 */
export function sameClaim(a: string, b: string): boolean {
  if (a === '' || b === '') return false;
  if (a === b) return true;
  const [targetA, wordsA] = split(a);
  const [targetB, wordsB] = split(b);
  if (targetA !== targetB) return false;
  return overlapScore({ title: '', body: wordsA }, { title: '', body: wordsB })
    >= NEAR_CLAIM_THRESHOLD;
}

/** The score `sameClaim` compared, for a caller that must report WHY. */
export function claimScore(a: string, b: string): number {
  if (a === '' || b === '') return 0;
  const [targetA, wordsA] = split(a);
  const [targetB, wordsB] = split(b);
  if (targetA !== targetB) return 0;
  return overlapScore({ title: '', body: wordsA }, { title: '', body: wordsB });
}
