/**
 * **A doctor finding a person has ruled on, and the anchor that stops the
 * ruling outliving what it ruled on.**
 *
 * Owner ruling, 2026-08-27. `doctor` reports findings that are worth a human's
 * eye and that no edit to the item can clear. The measured case is
 * `checkBodyAgreement`'s retraction branch: it fires on a body's own wording
 * and never reads the title, so when
 * `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` was correctly
 * retitled — removing a claim its own body had withdrawn — the finding did not
 * clear, and no edit to that item ever can. The check is right; the body DOES
 * withdraw something, and that is worth reading. What it cannot do is tell a
 * body nobody has read from one already judged. Nothing in this product could
 * record that difference, which is the owner's standing complaint that doctor
 * has "many items in notice that have no clean mechanism".
 *
 * This is that mechanism, and it is deliberately general: it lives beside
 * `runChecks` rather than inside one check, keys on `Finding.code`, and knows
 * nothing about which check produced the finding. Any finding on any item can
 * be acknowledged the day it starts being worth acknowledging.
 *
 * ── IT IS NOT A SILENCER, AND THE DIFFERENCE IS ENFORCED HERE ──────────────
 *
 * An acknowledged finding is still computed, still reported, still counted, and
 * still moves the exit code exactly as much as it did before — which for
 * `warn` and `info` is not at all, and for `error` is all the way. Nothing in
 * this module filters a finding out of anything. It marks one
 * (`Finding.acknowledged`), and every reporting surface draws the mark.
 * `INV-nothing-is-dropped-silently` is not weakened by a feature that adds a
 * word to a line.
 *
 * ── THE ANCHOR ─────────────────────────────────────────────────────────────
 *
 * "A person looked at this" is only true of the thing they looked at. An
 * acknowledgement stored as a bare flag would survive a rewrite of the very
 * body it certified, which is strictly worse than having no mechanism: the
 * finding that would have asked for a second reading is instead reported as
 * already settled. So an acknowledgement stores the identity of the content it
 * was made against — `itemContentHash(item)`, the same predicate `createItem`'s
 * dedupe and the pack collision report use — and `acknowledgementState`
 * measures the two against each other, exactly as `summaryState` measures
 * `summaryOf` against `itemSummaryBasis`.
 *
 * **Why the WHOLE content and not a per-check basis.** A narrower anchor —
 * "this check reads the body, so anchor the body" — would be a hand-kept table
 * of what each check looks at, sitting beside twenty checks that are free to
 * start looking at something else. That table cannot be compiler-checked
 * (`runChecks` hands every check the whole `Item`), and when it went stale it
 * would go stale in the unsafe direction: an acknowledgement that failed to
 * lapse when the field the check actually reads had moved. The whole content
 * is the only basis that cannot silently under-anchor, and it errs the other
 * way — a pin, a tag projection or a supersede lapses acknowledgements that a
 * narrower basis would have kept. That cost is real and is paid on purpose: a
 * lapsed acknowledgement asks a person to look again, and the worst it wastes
 * is a second glance.
 *
 * **The limit, stated rather than left to be discovered.** The anchor covers
 * the ITEM. A handful of checks compare an item against the world outside it —
 * `checkDeadScopes` walks the repository, `checkSourceDrift` reads the source
 * file, `checkIndexFreshness` stats the database — and for those, the world can
 * move under an acknowledgement that stays current. Acknowledging
 * `source_drift` and then letting the source drift a second, different way
 * leaves the ruling standing. There is no anchor available for that: hashing
 * "the repository" is not a thing this product can do in a doctor run. What
 * there IS, is the audit log, which records every acknowledgement with its
 * origin and its timestamp, so the question "when was this ruled on, and what
 * has happened since" is answerable — `REQ-changes-are-timestamped-and-audited`.
 */
import { itemContentHash } from './content-hash.ts';
import type { Item } from './types.ts';

/**
 * The frontmatter spelling of one acknowledgement: the finding code, `@`, and
 * the anchor.
 *
 * `@` and not `:` or `=`, because `serializeFrontmatter` quotes any scalar
 * containing a `:` and this list would then be written back with quotes an
 * author did not type. A finding code is `[a-z0-9_]+` everywhere in
 * `doctor/checks.ts` and an anchor is 16 hex characters, so neither half can
 * contain the separator; the split is on the LAST `@` anyway, so a code that
 * one day contains one still parses to the right anchor.
 */
const SEPARATOR = '@';

/** What an acknowledgement is, measured rather than assumed.
 *
 *  - `none` — nobody has ruled on this code for this item.
 *  - `current` — somebody ruled, and the item's content is what they ruled on.
 *  - `lapsed` — somebody ruled, and the content has moved since. The finding is
 *    open again; this is the whole point of storing an anchor rather than a
 *    flag.
 */
export type AcknowledgementState = 'none' | 'current' | 'lapsed';

export function acknowledgementState(item: Item, code: string): AcknowledgementState {
  const anchor = item.acknowledged[code];
  if (anchor === undefined) return 'none';
  return anchor === itemContentHash(item) ? 'current' : 'lapsed';
}

/** Whether a finding with this code on this item is one a person has ruled on
 * AND whose subject has not moved since. The one predicate every reporting
 * surface asks, so no caller has to remember that `lapsed` exists. */
export function isAcknowledged(item: Item, code: string): boolean {
  return acknowledgementState(item, code) === 'current';
}

/**
 * **The only way an acknowledgement is written.** Records the code and the
 * anchor together, so the pair cannot come apart — `stampSummary`'s shape, for
 * `stampSummary`'s reason.
 *
 * Called AFTER every other field of the item has been assigned, or the anchor
 * would be taken over content the write is about to change.
 *
 * A lapsed acknowledgement re-acknowledged through here is re-anchored to the
 * content in front of the person now, which is correct: they read it again.
 */
export function stampAcknowledgement(item: Item, code: string): void {
  item.acknowledged[code] = itemContentHash(item);
}

/** Removes one. Absent and present both end in the same place, so a caller
 * withdrawing an acknowledgement that was never made is not an error — but the
 * return value says which happened, because the CLI reports it. */
export function clearAcknowledgement(item: Item, code: string): boolean {
  if (!Object.hasOwn(item.acknowledged, code)) return false;
  delete item.acknowledged[code];
  return true;
}

/**
 * The frontmatter list, in code order.
 *
 * Sorted, and the sort is safe here in a way it is not for `SUMMARY_BASIS`'s
 * field order: this is a MAP, so its key order carries no meaning, and a fixed
 * order is what keeps `renderItem` byte-stable when a second acknowledgement is
 * added to an item that already had one.
 */
export function renderAcknowledged(acknowledged: Record<string, string>): string[] {
  return Object.keys(acknowledged).sort().map((code) => `${code}${SEPARATOR}${acknowledged[code]}`);
}

/**
 * The frontmatter list read back.
 *
 * An entry with no separator, or with an empty half, is DROPPED rather than
 * stored as a broken acknowledgement — and dropping it is the safe direction
 * here, unlike everywhere else in this parser: an unreadable acknowledgement
 * that survived as some string would compare unequal to the item's real hash
 * forever, which is `lapsed`, which is a reported finding. Nothing is hidden by
 * failing to read one; the finding is simply open, which is where it started.
 * A later `mycontext ack` writes the entry properly.
 */
export function parseAcknowledged(entries: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const at = entry.lastIndexOf(SEPARATOR);
    if (at <= 0 || at === entry.length - 1) continue;
    out[entry.slice(0, at)] = entry.slice(at + 1);
  }
  return out;
}
