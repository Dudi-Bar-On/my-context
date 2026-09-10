#!/usr/bin/env node
/**
 * **One-off corpus migration for the 2026-09-10 owner ruling that took
 * LIFECYCLE OBSERVATIONS out of the summary staleness basis**
 * (`LIFECYCLE_OBSERVATION_CATEGORIES`, core/content-hash.ts — D43).
 *
 *   node scripts/restamp-summary-basis-lifecycle.ts [<workspace root>]           # dry run
 *   node scripts/restamp-summary-basis-lifecycle.ts [<workspace root>] --apply   # writes
 *
 * `<workspace root>` is the `.my_context` directory, defaulting to
 * `<cwd>/.my_context`.
 *
 * ── WHY A MIGRATION IS NEEDED AT ALL ───────────────────────────────────────
 *
 * The sibling script `restamp-summary-basis.ts` says it in full for the
 * 2026-08-27 `title` ruling, and every word of its argument transfers: an
 * item's `summary_of` records `itemSummaryBasis(item)` as of the write that set
 * the summary, so changing what that function hashes stops the recorded value
 * matching — not because the item moved, but because the question changed.
 *
 * The one difference is REACH, and it is why this is a second script rather
 * than a second run of the first. Reclassifying `title` moved the basis of
 * every item in the corpus at once. Excluding `retirement` and `supersession`
 * notes moves the basis of exactly the items that CARRY one: an item with no
 * lifecycle observation hashes an unchanged list and its recorded value still
 * matches. Measured on the 1077-item corpus at `../.my_context` the moment the
 * ruling landed: 12 items carry a lifecycle observation, all 12 read `current`
 * before the change and all 12 read `stale` after it, and no other item moved.
 *
 * Those 12 read `current` for the ordinary reason — their summaries were
 * written (or re-affirmed) after the supersession, so the note was already on
 * the item when the basis was stamped. They are the items this ruling would
 * turn from a true `current` into a FALSE `stale`, which is the mirror of the
 * defect D43 exists to fix, and the reason the ruling and this migration are
 * one act.
 *
 * ── THE ONE RULE, AND WHY THIS IS NOT A BLANKET RE-STAMP ────────────────────
 *
 * Unchanged from the sibling: **a re-stamp may never turn a REAL stale into a
 * FALSE current.** An item is re-stamped only when its recorded basis still
 * matches the OLD formula, recomputed here over the item as it stands on disk.
 * That equality is a proof and not a heuristic — it says the body, steps,
 * observations and non-workflow `extra` keys are all exactly what they were
 * when the summary was written, so the new basis computed now is the value
 * `stampSummary` would have recorded at that moment had this ruling existed
 * then. The item's verdict was `current` before and is `current` after, and no
 * claim is made that was not already true.
 *
 * Everything else is left untouched and reported. An item that is genuinely
 * stale keeps its old basis and stays stale; a person clears one with
 * `mycontext edit <id> --summary "<text>"`, which is a human re-reading the
 * item and re-anchoring the sentence.
 *
 * **This is also why it must not be run before the code change lands, and is a
 * no-op after it has run once.** Once every basis is a new-formula value,
 * nothing can match the old formula again.
 *
 * ── WHAT IS WRITTEN ────────────────────────────────────────────────────────
 *
 * `summary_of`, and the `checksum` that covers it (`computeItemChecksum` hashes
 * the pair — item.ts). Nothing else. The script refuses to write any file whose
 * `renderItem(parseItem(file))` is not already byte-identical to what is on
 * disk, so a hand-authored file cannot be silently reformatted by a migration
 * that was only ever asked to move one line.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalContent, itemSummaryBasis, summarisedExtra } from '../src/core/content-hash.ts';
import { parseItem, renderItem } from '../src/core/item.ts';
import { writeItem } from '../src/core/rebuild.ts';
import { checksum } from '../src/core/slug.ts';
import type { Item } from '../src/core/types.ts';

/**
 * The summarised fields as `SUMMARY_BASIS` declares them — unchanged by this
 * ruling, which is the whole point: the field list did not move, only what the
 * `observations` entry counts.
 *
 * Written out here rather than derived from `SUMMARISED_FIELDS`, for the reason
 * the sibling script's fossil is written out: this is the only remaining
 * statement of the formula every value now on disk was computed with, and the
 * safety argument rests on recomputing it exactly. `summarisedExtra` IS
 * imported rather than copied, because that half of the formula did not change
 * and a second copy of `WORKFLOW_EXTRA_KEYS` could disagree with the real one.
 * It is a fossil on purpose. Nothing else may import it, and when this
 * migration has run everywhere it can be deleted with the file.
 */
const OLD_SUMMARISED_FIELDS = ['body', 'steps', 'observations', 'extra'] as const;

/** `itemSummaryBasis` as it was before the ruling: the same fields, the same
 * `extra` filter, and `observations` UNFILTERED. */
function oldSummaryBasis(item: Item): string {
  const canonical = canonicalContent(item) as unknown as Record<string, unknown>;
  const shape: Record<string, unknown> = {};
  for (const field of OLD_SUMMARISED_FIELDS) {
    shape[field] = field === 'extra'
      ? summarisedExtra(canonical.extra as Record<string, string>)
      : canonical[field];
  }
  return checksum(JSON.stringify(shape));
}

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const positional = args.filter((a) => !a.startsWith('--'));
const root = path.resolve(positional[0] ?? path.join(process.cwd(), '.my_context'));

const files = walk(path.join(root, 'items')).sort();
if (files.length === 0) {
  throw new Error(`my_context: no item files under ${path.join(root, 'items')}.`);
}

const restamped: string[] = [];
const unaffected: string[] = [];
const leftStale: string[] = [];
const noSummary: string[] = [];
const unanchored: string[] = [];
const refused: string[] = [];

for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const raw = readFileSync(file, 'utf8');
  let item: Item;
  try {
    item = parseItem(raw, rel, 'project');
  } catch (err) {
    refused.push(`${rel}: unparseable — ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }
  if (item.summary === null) { noSummary.push(item.id); continue; }
  if (item.summaryOf === null) { unanchored.push(item.id); continue; }

  const fresh = itemSummaryBasis(item);
  // **Reported separately rather than folded into `restamped`, because it is
  // the measurement this ruling's narrow reach rests on.** An item carrying no
  // lifecycle observation hashes the same list under both formulas, so the two
  // values agree and there is nothing to write. If this bucket were ever small
  // the ruling would be wider than it was argued to be.
  if (item.summaryOf === fresh) { unaffected.push(item.id); continue; }
  if (item.summaryOf !== oldSummaryBasis(item)) { leftStale.push(item.id); continue; }

  // The byte-identity guard, for the sibling script's stated reason: `writeItem`
  // renders the whole item, so a file that does not already round-trip would
  // come back reformatted by a migration asked to move one line, and the
  // difference would be invisible in the summary below.
  if (renderItem(item) !== raw) {
    refused.push(`${rel}: does not round-trip byte-identically; not rewritten`);
    continue;
  }

  item.summaryOf = fresh;
  if (apply) writeItem(root, item);
  restamped.push(item.id);
}

console.log(`root: ${root}`);
console.log(`${files.length} file(s); ${apply ? 'APPLIED' : 'DRY RUN — pass --apply to write'}`);
console.log(`  re-stamped (was current, stays current): ${restamped.length}`);
for (const id of restamped) console.log(`      ${id}`);
console.log(`  already agree, nothing to do:            ${unaffected.length}`);
// "Its recorded basis matches neither formula", which means the item is stale
// for a reason this ruling did not cause and must stay stale.
console.log(`  left alone (stale under BOTH formulas):  ${leftStale.length}`);
for (const id of leftStale) console.log(`      ${id}`);
console.log(`  no summary, nothing to stamp:            ${noSummary.length}`);
console.log(`  unanchored (summary, no basis):          ${unanchored.length}`);
for (const id of unanchored) console.log(`      ${id}`);
if (refused.length > 0) {
  console.log(`  REFUSED — nothing written for these:    ${refused.length}`);
  for (const line of refused) console.log(`      ${line}`);
}
