#!/usr/bin/env node
/**
 * **One-off corpus migration for the 2026-08-27 owner ruling that took `title`
 * out of the summary staleness basis** (`SUMMARY_BASIS`, core/content-hash.ts).
 *
 *   node scripts/restamp-summary-basis.ts [<workspace root>]           # dry run
 *   node scripts/restamp-summary-basis.ts [<workspace root>] --apply   # writes
 *
 * `<workspace root>` is the `.my_context` directory, defaulting to
 * `<cwd>/.my_context`.
 *
 * ── WHY A MIGRATION IS NEEDED AT ALL ───────────────────────────────────────
 *
 * `Item.summaryOf` records `itemSummaryBasis(item)` as of the write that set
 * the summary. Reclassifying ONE field changes what that function hashes, so
 * every value recorded under the old formula stops matching — not because any
 * item moved, but because the question changed. Measured on the 733-item corpus
 * at `../.my_context` before anything was touched: 717 items carry a summary,
 * 713 of them read `current` under the old basis and 4 read `stale`; under the
 * new basis and with no migration, **717 of 717 read `stale`**. A staleness
 * signal that fires on every item at once is a staleness signal nobody reads.
 *
 * ── THE ONE RULE, AND WHY THIS IS NOT A BLANKET RE-STAMP ────────────────────
 *
 * A re-stamp may never turn a REAL stale into a FALSE current. Blanket-stamping
 * every item with the new basis would do exactly that to the 4 items that are
 * genuinely stale today: their summaries would be certified as describing text
 * nobody has checked them against, and the only evidence that they do not would
 * be gone.
 *
 * So an item is re-stamped only when its recorded basis still matches the OLD
 * formula, recomputed here over the item as it stands on disk. That equality is
 * a proof, not a heuristic: it says the title, body, steps, observations and
 * extra fields are all exactly what they were when the summary was written, so
 * the new basis computed now is the same value that `stampSummary` would have
 * recorded at that moment had this ruling existed then. Its verdict was
 * `current` before and is `current` after, and no claim is made that was not
 * already true.
 *
 * Everything else is left untouched and reported. An item that is stale keeps
 * its old basis and stays stale — including one whose staleness is only the
 * retitle this ruling exists to stop, because that cannot be told apart from a
 * moved body without the old text, and guessing in that direction is precisely
 * the forbidden move. A person clears one with
 * `mycontext edit <id> --summary "<text>"`, which is a human re-reading the
 * item and re-anchoring the sentence — the act the field exists to record.
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
import { canonicalContent, itemSummaryBasis } from '../src/core/content-hash.ts';
import { parseItem, renderItem } from '../src/core/item.ts';
import { writeItem } from '../src/core/rebuild.ts';
import { checksum } from '../src/core/slug.ts';
import type { Item } from '../src/core/types.ts';

/**
 * The summarised fields as `SUMMARY_BASIS` declared them BEFORE the ruling, in
 * that table's declaration order.
 *
 * Written out here rather than imported, because the thing it describes no
 * longer exists: this is the only remaining statement of the formula every
 * value now on disk was computed with, and the script's whole safety argument
 * rests on recomputing it exactly. It is a fossil on purpose. Nothing else may
 * import it, and when this migration has run everywhere it can be deleted with
 * the file.
 */
const OLD_SUMMARISED_FIELDS = ['title', 'body', 'steps', 'observations', 'extra'] as const;

/** `itemSummaryBasis` as it was before the ruling. Same canonicalisation, one more field. */
function oldSummaryBasis(item: Item): string {
  const canonical = canonicalContent(item) as unknown as Record<string, unknown>;
  const shape: Record<string, unknown> = {};
  for (const field of OLD_SUMMARISED_FIELDS) shape[field] = canonical[field];
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
  if (item.summaryOf !== oldSummaryBasis(item)) { leftStale.push(item.id); continue; }

  // The byte-identity guard. `writeItem` renders the whole item, so a file that
  // does not already round-trip would come back reformatted by a migration
  // asked to move one line — and the difference would be invisible in the
  // summary below. Refuse it and name it instead.
  if (renderItem(item) !== raw) {
    refused.push(`${rel}: does not round-trip byte-identically; not rewritten`);
    continue;
  }

  item.summaryOf = itemSummaryBasis(item);
  if (apply) writeItem(root, item);
  restamped.push(item.id);
}

console.log(`root: ${root}`);
console.log(`${files.length} file(s); ${apply ? 'APPLIED' : 'DRY RUN — pass --apply to write'}`);
console.log(`  re-stamped (was current, stays current): ${restamped.length}`);
// "Its recorded basis does not match the OLD formula", which before the
// migration means STALE and after it means ALREADY MIGRATED. Both are the same
// instruction — leave it alone — so they share a bucket, and the label says the
// predicate rather than one of its two causes. This is also what makes a second
// run a no-op: once every basis is a new-formula value, nothing here can match
// the old formula again, so the script cannot re-stamp — and in particular
// cannot bless the items that are genuinely stale.
console.log(`  left alone (basis is not an OLD-formula value): ${leftStale.length}`);
for (const id of leftStale) console.log(`      ${id}`);
console.log(`  no summary, nothing to stamp:            ${noSummary.length}`);
console.log(`  unanchored (summary, no basis):          ${unanchored.length}`);
for (const id of unanchored) console.log(`      ${id}`);
if (refused.length > 0) {
  console.log(`  REFUSED — nothing written for these:    ${refused.length}`);
  for (const line of refused) console.log(`      ${line}`);
}
