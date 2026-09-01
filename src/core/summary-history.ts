/**
 * **A summary follows its body, and the sentences it replaced are kept.**
 *
 * Owner ruling: *"i want that everytime body is changed, the summary should
 * too, based on the new body. we could leave history of summaries that does not
 * take long space and should not be injected."*
 *
 * The ruling is two mechanisms, not one, and the reason is a constraint rather
 * than a preference: **nothing in this codebase can write a sentence.** Zero
 * runtime dependencies (`CONST-zero-runtime-dependencies`), no model access, and
 * a summary is written by an agent as an ordinary prompt. So `edit` and `doctor`
 * can both DETECT that a body moved; neither can GENERATE the replacement.
 *
 *  - **The gate**, `summary-gate.ts`, refuses an edit that moves the summarised
 *    content without a summary to go with it. It runs where the person or agent
 *    is already holding the new text.
 *  - **The net**, `checkSummary` (doctor/checks.ts), reports the one case the
 *    gate cannot reach: a hand-edited `.md`, which markdown-as-source-of-truth
 *    explicitly permits. It is unchanged and must stay unchanged — the gate
 *    cannot see a hand edit and doctor cannot prevent one.
 *
 * This module is the third part: what happens to the sentence that was there.
 *
 * ── WHY THE HISTORY LIVES IN THE ITEM ──────────────────────────────────────
 *
 * `INV-markdown-is-the-source-of-truth` documents this project's recovery as
 * "delete the index, it rebuilds". History kept in the SQLite index, or in
 * `state/`, or in the revision log does not survive that — and a history that
 * evaporates on the documented recovery path is worse than none, because it
 * reads as "this summary has always said this".
 *
 * The audit log is not an alternative either, for a reason it states about
 * itself: it records that a field MOVED (`AUDITED_FIELDS`, persist.ts), never
 * the text. Recovering a previous summary from it is not possible in principle.
 *
 * ── AND WHY IT IS CAPPED ───────────────────────────────────────────────────
 *
 * The item file is the one artefact this product promises to round-trip byte
 * for byte, and this is the only field on it that never shrinks. Three is the
 * owner's "does not take long space" made a number: at `SUMMARY_MAX_CHARS` (160)
 * plus a date, a full history costs about 520 bytes on an item whose body has a
 * median of 1,693 — visible in a diff, invisible in a corpus. The cap is applied
 * ONLY when appending; a file that arrives from disk carrying more entries keeps
 * every one of them until something appends, because dropping authored text at
 * read time is the silent loss `INV-nothing-is-dropped-silently` forbids and
 * would break the byte-identical round trip for that file.
 */
import { stampSummary } from './content-hash.ts';
import type { Item, PreviousSummary } from './types.ts';

/**
 * How many previous summaries an item keeps.
 *
 * Three, by the owner's "does not take long space". The oldest drops off; the
 * newest is first, so the drop is a `slice` from one end and a reader meets the
 * most recent sentence first.
 */
export const SUMMARY_HISTORY_MAX = 3;

/**
 * The frontmatter spelling of one previous summary: the date, a space, and the
 * sentence.
 *
 * The date FIRST and fixed-width, which is what makes the split unambiguous
 * against a summary that may contain anything at all — including a date. A
 * separator character in the middle (`acknowledged`'s `@`) cannot be used here
 * for exactly that reason: a finding code and a 16-hex anchor can promise not
 * to contain one, and a plain English sentence can promise nothing.
 *
 * `serializeFrontmatter` quotes and escapes a list entry that needs it
 * (`emitScalar`, frontmatter.ts) and `unquote` reverses that, so a summary
 * containing `:`, `#`, quotes or backslashes survives unaltered. Nothing here
 * has to know that; it is why this renders to a plain string and not to a
 * hand-escaped one.
 */
const DATED = /^(\d{4}-\d{2}-\d{2}) (.*)$/;

/**
 * The frontmatter list, newest first — the order `push` maintains, never
 * sorted.
 *
 * `renderAcknowledged` sorts and says why the sort is safe THERE: it renders a
 * map, whose key order carries no meaning. This is a sequence and the order IS
 * the meaning, so sorting it would silently rewrite which summary came before
 * which. The two neighbours differ deliberately.
 */
export function renderSummaryWas(history: PreviousSummary[]): string[] {
  return history.map((e) => (e.at === null ? e.text : `${e.at} ${e.text}`));
}

/**
 * The frontmatter list read back.
 *
 * An entry with no leading date is KEPT WHOLE, with `at: null` — the opposite
 * of `parseAcknowledged`, which drops what it cannot read, and the difference is
 * the difference between the two fields. An unreadable acknowledgement is a
 * claim about a person's attention and dropping it merely reopens a finding; an
 * entry here is AUTHORED TEXT, and dropping it would delete a sentence somebody
 * wrote and then report the write as a success. Keeping it whole is also what
 * makes the round trip byte-identical for a file a human typed by hand:
 * `renderSummaryWas` emits an `at: null` entry as exactly the string it read.
 *
 * No cap is applied here, deliberately — see the module comment.
 */
export function parseSummaryWas(entries: string[]): PreviousSummary[] {
  return entries.map((entry) => {
    const m = DATED.exec(entry);
    return m === null ? { at: null, text: entry } : { at: m[1], text: m[2] };
  });
}

/**
 * **The only way a summary is replaced**, and the only writer of the history.
 *
 * `stampSummary` (content-hash.ts) stays what it always was — the pair of
 * `summary` and the basis it was written against, set together so they cannot
 * come apart. This wraps it with the one thing the ruling added: the sentence
 * being replaced is recorded before the new one lands.
 *
 * Three cases, and only the first appends:
 *
 *  - **replaced** — there was a summary, and `next` says something different.
 *    The old one goes on the front of the history with the date it stopped
 *    being true. A CLEAR (`next === null`, from `--summary=`) is a replacement:
 *    the item stops saying it, and that is exactly the case where a reader most
 *    needs to see what it used to say.
 *  - **first** — there was none. Nothing is recorded, because nothing was
 *    replaced; an empty history on an item that has only ever had one summary
 *    is the honest state.
 *  - **re-stamped** — `next` is the text the item already carries. This is the
 *    escape hatch's path (`--summary-unchanged`, which passes `item.summary`
 *    straight back through here) and it must not append: recording a summary as
 *    "previous" while it is still the current one would put the same sentence in
 *    the file twice and date the live one as retired.
 *
 * `at` is passed in rather than read from a clock here, so this module holds no
 * dependency on `persist.ts` and every caller stamps the same date it stamps
 * everything else with (`today()`, persist.ts).
 */
export function reviseSummary(item: Item, next: string | null, at: string): void {
  if (item.summary !== null && item.summary !== next) {
    item.summaryWas = [
      { at, text: item.summary },
      ...item.summaryWas,
    ].slice(0, SUMMARY_HISTORY_MAX);
  }
  stampSummary(item, next);
}

/**
 * **The escape hatch, applied.** Re-stamps the basis from the item as it now
 * stands, leaving the summary's TEXT exactly where it was.
 *
 * This is what `--summary-unchanged` / `summary_unchanged: true` performs, and
 * it is deliberately not a second mechanism: it re-enters `reviseSummary` with
 * the summary the item already carries, so the basis is stamped by the one
 * function that stamps bases and the history is skipped by the one rule that
 * skips it. There is no path here that writes a basis some other way.
 *
 * A caller must have established that the hatch is ALLOWED before calling this
 * — `summaryUnchangedRefusal` (summary-gate.ts) is that check. Nothing is
 * enforced here, because this function is the act and not the permission.
 */
export function reaffirmSummary(item: Item): void {
  reviseSummary(item, item.summary, '');
}

/**
 * What the audit row says when the hatch was used.
 *
 * One string, exported, because two surfaces write an edit that can carry the
 * hatch and a third (`mycontext audit`, and anyone grepping the JSONL) reads it
 * back. A note spelled two ways is a note that answers "did anybody rewrite the
 * summary" correctly for one door and not the other.
 *
 * Hyphenated rather than spelled as prose so it greps as one token, and short
 * enough to sit in a `note` column beside a discard reason.
 */
export const SUMMARY_UNCHANGED_NOTE = 'summary-unchanged';
