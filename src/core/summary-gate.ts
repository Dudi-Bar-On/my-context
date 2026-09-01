/**
 * **The gate: an edit that moves what a summary summarises must bring the new
 * summary with it.**
 *
 * Owner ruling: *"everytime body is changed, the summary should too, based on
 * the new body."* Nothing in this codebase can write that sentence — zero
 * runtime dependencies, no model access, and summaries are written by an agent
 * as an ordinary prompt — so the ruling cannot be honoured by generating a
 * replacement. It is honoured by REFUSING at the one moment the replacement is
 * cheap: whoever is editing has just read the item and is holding the new text.
 *
 * ── THE TRIGGER IS DERIVED, AND THAT IS THE WHOLE DESIGN ───────────────────
 *
 * The obvious implementation is a list of flags that invalidate a summary —
 * `--body`, `--extra`, and whatever else somebody remembers. **That list is the
 * defect this repository has measured eight times**, and `SUMMARY_BASIS`
 * (content-hash.ts) says so in its own comment about a ninth. A second list
 * beside the hash can disagree with it in both directions, and both are bad: a
 * flag on the list that does not move the basis refuses an edit for nothing, and
 * a flag off the list that DOES move it is the silent hole the gate exists to
 * close.
 *
 * So there is no list here. `basisMoves` builds the item as the edit would leave
 * it, hands it to `itemSummaryBasis`, and compares. Every question about which
 * field counts is answered by `SUMMARY_BASIS` and by nothing in this file —
 * including questions nobody has asked yet: the day `tags` is reclassified as
 * `summarised`, a `--tags` edit starts requiring a summary here with no change
 * to this module, because `afterContent` already carries the patched tags into
 * the hash.
 *
 * ── WHAT IT DELIBERATELY DOES NOT COVER ────────────────────────────────────
 *
 * **A hand-edited `.md` file.** Markdown is the source of truth and editing one
 * by hand is permitted; no gate at a command boundary can see it. That is
 * `summary_stale` (`checkSummary`, doctor/checks.ts), which stays exactly as it
 * is — the gate is the only thing that can PREVENT the case, doctor is the only
 * thing that can SEE the other one, and neither alone closes the hole.
 *
 * **Every mechanical internal write.** A gate that blocked `repair`, a tag
 * projection, a promotion of a revision a human already approved, or a pack
 * import would be a regression: none of those callers is a person holding new
 * prose, and refusing them would leave the corpus unmaintainable in order to
 * protect one sentence. So this module exports predicates and refusals and is
 * imported by exactly the two AUTHORED surfaces — `mycontext edit` and the MCP
 * `update_item` tool. It is deliberately NOT called from `updateItem`, which is
 * the shared road every internal caller drives down.
 */
import { itemSummaryBasis, type ContentShape } from './content-hash.ts';
import { normalizePosix } from './paths.ts';
import { normalizeEol } from './text.ts';
import type { UpdateInput } from './mutate.ts';
import type { Item } from './types.ts';

/**
 * The item's content as this edit would leave it — every field of
 * `ContentShape`, not merely the summarised ones.
 *
 * **Whole rather than narrowed, on purpose.** Projecting only the fields
 * `SUMMARY_BASIS` currently calls `summarised` would put a copy of that
 * classification here, which is the second list this module exists not to have.
 * Building the whole shape leaves the classification in one place: this
 * function knows how an edit changes an item, `SUMMARY_BASIS` knows which of
 * those changes a summary cares about, and neither knows the other's answer.
 *
 * The normalisations mirror `updateItem`'s, field for field — `title.trim()`,
 * `normalizeEol(body).trim()`, `normalizePosix` on each glob, `extra` MERGED
 * rather than replaced — because the hash has to be taken over what will be
 * WRITTEN, not over what was typed. A `--body` that differs from the stored one
 * only in trailing whitespace moves nothing once written, and must not be
 * refused for a change it does not make. `steps` and `observations` are absent
 * from `UpdateInput` (create-only, see `Item.steps`), so they carry through
 * unchanged.
 *
 * This is `afterShape`'s shape (cli/commands/edit.ts), one field class further
 * out and for the same stated reason: an "after" answered by the real predicate
 * rather than predicted beside it.
 */
export function afterContent(item: Item, patch: UpdateInput): ContentShape {
  return {
    type: item.type,
    title: patch.title === undefined ? item.title : patch.title.trim(),
    body: patch.body === undefined ? item.body : normalizeEol(patch.body).trim(),
    steps: item.steps,
    severity: patch.severity ?? item.severity,
    always: patch.always ?? item.always,
    continuity: patch.continuity ?? item.continuity,
    scope: patch.scope === undefined ? item.scope : patch.scope.map((g) => normalizePosix(g)),
    tags: patch.tags ?? item.tags,
    observations: item.observations,
    relations: item.relations,
    // MERGED, matching `item.extra = { ...item.extra, ...update.extra }` in
    // `updateItem`: a call naming one key does not clear the others, so a hash
    // taken over the patch alone would report a change to every key the caller
    // did not mention.
    extra: patch.extra === undefined ? item.extra : { ...item.extra, ...patch.extra },
  };
}

/** Whether this edit moves the content the item's summary was written against
 * — the one question the gate asks, answered by the one function that defines
 * the basis. An echo moves nothing and is not a change here either. */
export function basisMoves(item: Item, patch: UpdateInput): boolean {
  return itemSummaryBasis(afterContent(item, patch)) !== itemSummaryBasis(item);
}

/**
 * Whether this edit must carry a summary, and the answer is no in three cases
 * that matter more than the one where it is yes:
 *
 *  - **The item has no summary.** There is nothing to invalidate. Requiring one
 *    here would turn the gate into a campaign to summarise the corpus, which is
 *    not what was ruled and would refuse every edit to the 16 items that have
 *    none.
 *  - **The edit already carries one**, including the CLEAR (`--summary=`, which
 *    arrives as the empty string). Removing a summary that no longer describes
 *    the item is a valid answer to "the body moved"; it is not as good as a new
 *    sentence, and it is honest, which is the bar.
 *  - **The edit moves nothing summarised.** A pin, a retag, a scope narrowing, a
 *    status change, a relation removed — none of them changes a word of what
 *    the summary would say, and `SUMMARY_BASIS` argues each one.
 */
export function summaryRequired(item: Item, patch: UpdateInput): boolean {
  if (item.summary === null) return false;
  if (patch.summary !== undefined) return false;
  if (patch.summaryUnchanged === true) return false;
  return basisMoves(item, patch);
}

/**
 * The refusal, in the project's voice, and it does the three things the ruling
 * asks of it: says WHY, SHOWS what the summary currently says so the writer can
 * judge how much has to move, and names both ways out.
 *
 * The current summary is quoted in full rather than truncated — it is at most
 * `SUMMARY_MAX_CHARS` and the entire point of printing it is that the reader
 * decides whether it still fits.
 *
 * `surface` picks the spelling of the two remedies, because a refusal that names
 * a command the reader cannot run is worse than one that names nothing: the CLI
 * gets flags, the MCP tool gets its own arguments.
 */
export function summaryRequiredRefusal(item: Item, surface: 'edit' | 'update_item'): string {
  const rewrite = surface === 'edit'
    ? `\`mycontext edit ${item.id} --body "<new text>" --summary "<one plain sentence>"\``
    : `update_item({ id: "${item.id}", …, summary: "<one plain sentence>" })`;
  const hatch = surface === 'edit'
    ? `\`--summary-unchanged\``
    : `\`summary_unchanged: true\``;
  return (
    `my_context: this edit changes what ${item.id} SAYS, so the summary written against the old ` +
    `text would no longer describe it — and nothing in this product can write the replacement, ` +
    `because a summary is one plain sentence and this CLI has no model. You have just read the ` +
    `item and are holding the new text, so this is the cheapest moment there will ever be. ` +
    `Nothing was changed. Its summary today reads: "${item.summary}". Send the edit again with ` +
    `the new summary — ${rewrite} — or, if this edit genuinely does not change what the item ` +
    `means (a typo, a reflow, a rewrapped paragraph), say so with ${hatch}, which re-stamps the ` +
    `basis without new text and records in the audit log that nobody rewrote it.`
  );
}

/**
 * The escape hatch's own refusals — the two ways of asking for it that have no
 * honest outcome.
 *
 * **Both spellings at once.** `--summary "<text>" --summary-unchanged` says the
 * summary changed and did not change. There is no reading that honours both, and
 * honouring either drops the other while reporting success — the rule
 * `--always` given as true and false is already refused under, and the rule
 * `--clear --tag` is refused under in `focus.ts`.
 *
 * **An edit that moves nothing summarised.** The hatch is an ANSWER to the gate,
 * never a standalone act, and this is the clause that keeps it one. Without it,
 * `mycontext edit <id> --summary-unchanged` on an item whose summary is already
 * stale would mark it current — a machine recording that this summary was
 * checked against this text when nobody checked it, which is exactly what
 * `checkSummary` refuses to do when it declines to repair an unanchored basis on
 * its own. A summary that has genuinely gone stale is fixed by writing a new
 * one, and the refusal says so.
 *
 * `null` when the hatch is legitimate, so a caller cannot print an empty
 * refusal beside a perfectly good edit.
 */
export function summaryUnchangedRefusal(
  item: Item, patch: UpdateInput, surface: 'edit' | 'update_item',
): string | null {
  if (patch.summaryUnchanged !== true) return null;
  const hatch = surface === 'edit' ? '--summary-unchanged' : 'summary_unchanged: true';
  const write = surface === 'edit'
    ? `\`mycontext edit ${item.id} --summary "<text>"\``
    : `update_item({ id: "${item.id}", summary: "<text>" })`;
  if (patch.summary !== undefined) {
    const wrote = surface === 'edit' ? '--summary' : 'summary';
    return (
      `my_context: this call passes both "${wrote}" and ${hatch}, which say that the summary ` +
      `changed and that it did not. There is no reading of that which honours both, and ` +
      `honouring either would drop the other while reporting success. Nothing was changed — ` +
      `pass one of them.`
    );
  }
  if (item.summary === null) {
    return (
      `my_context: ${hatch} says an edit leaves an existing summary still true, and ${item.id} ` +
      `has no summary to leave. Nothing was changed. Drop the flag; an item with no summary is ` +
      `never gated, because there is nothing for an edit to invalidate.`
    );
  }
  if (!basisMoves(item, patch)) {
    return (
      `my_context: ${hatch} answers the gate that asks for a new summary, and this edit does not ` +
      `raise it — nothing it changes is part of what a summary summarises (see the field table ` +
      `in content-hash.ts). Accepting it would re-stamp the basis on an edit that was never ` +
      `asked about, which on an already-stale summary would record that somebody checked this ` +
      `sentence against this text when nobody did. Nothing was changed. If the summary IS stale, ` +
      `write a new one: ${write}.`
    );
  }
  return null;
}
