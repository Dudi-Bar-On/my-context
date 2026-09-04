#!/usr/bin/env node
/**
 * **One-off corpus migration for the 2026-09-04 owner ruling that took
 * `state`, `plan`, `seq`, `priority`, `source`, `progress` and `last_change`
 * out of the summary staleness basis** (`WORKFLOW_EXTRA_KEYS`,
 * core/content-hash.ts) — the same migration `restamp-summary-basis.ts` ran
 * for the 2026-08-27 `title` reclassification, applied to the next field.
 *
 *   node scripts/restamp-summary-basis-workflow-extra.ts [<workspace root>]           # dry run
 *   node scripts/restamp-summary-basis-workflow-extra.ts [<workspace root>] --apply   # writes
 *
 * `<workspace root>` is the `.my_context` directory, defaulting to
 * `<cwd>/.my_context`.
 *
 * ── WHY A MIGRATION IS NEEDED AT ALL ───────────────────────────────────────
 *
 * `Item.summaryOf` records `itemSummaryBasis(item)` as of the write that set
 * the summary. Narrowing what `extra` contributes to that hash changes what
 * the function computes for every item whose `extra` bag carries one of the
 * seven excluded keys — which is every `task`, because `plan`/`seq`/`state`
 * live there by the category's own design (`categories.ts`: "its plan,
 * sequence and state live in extra fields"). Measured on this corpus before
 * this script ran: 563 tasks, every one reading `current`, flipped to
 * `summary_stale` in one `doctor` run — not because any of them moved, but
 * because the question changed. That is the identical shape the `title`
 * migration measured (717 of 717), and it is not a coincidence: reclassifying
 * a field in `SUMMARY_BASIS` (or, here, one KEY inside a field it already
 * covers) invalidates every basis computed under the old formula at once.
 *
 * ── THE ONE RULE, AND WHY THIS IS NOT A BLANKET RE-STAMP ────────────────────
 *
 * A re-stamp may never turn a REAL stale into a FALSE current. So an item is
 * re-stamped only when its recorded basis still matches the OLD formula —
 * `itemSummaryBasis` exactly as it read before this ruling, i.e. `extra`
 * contributed WHOLE, with no key excluded — recomputed here over the item as
 * it stands on disk. That equality is a proof, not a heuristic: it says the
 * title, body, steps, observations and full extra bag are all exactly what
 * they were when the summary was written, so the new (narrower) basis
 * computed now is the value `stampSummary` would have recorded at that
 * moment had this ruling existed then. Its verdict was `current` before and
 * is `current` after; no claim is made that was not already true.
 *
 * Everything else — an item already `stale` under the old formula — is left
 * untouched and reported. A person clears one with
 * `mycontext edit <id> --summary "<text>"` (a new sentence) or
 * `--summary "<the same sentence>"` (a re-affirmation, if it is still
 * correct) — a human re-reading the item, which is the act this field exists
 * to record.
 *
 * ── WHAT IS WRITTEN ────────────────────────────────────────────────────────
 *
 * `summary_of`, and the `checksum` that covers it (`computeItemChecksum`
 * hashes the pair — item.ts). Nothing else. The script refuses to write any
 * file whose `renderItem(parseItem(file))` is not already byte-identical to
 * what is on disk, so a hand-authored file cannot be silently reformatted by
 * a migration that was only ever asked to move one line.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalContent, itemSummaryBasis } from '../src/core/content-hash.ts';
import { parseItem, renderItem } from '../src/core/item.ts';
import { writeItem } from '../src/core/rebuild.ts';
import { checksum } from '../src/core/slug.ts';
import type { Item } from '../src/core/types.ts';

/**
 * The summarised fields as `SUMMARY_BASIS` declared them, and the shape
 * `extra` was hashed in, BEFORE this ruling — i.e. `content-hash.ts` exactly
 * as `restamp-summary-basis.ts` (the `title` migration) left it: `extra`
 * contributed WHOLE, with no per-key exclusion.
 *
 * Written out here rather than imported, for the reason the `title` script's
 * own fossil gives: this is the only remaining statement of the formula
 * every value now on disk was computed with, and the safety argument rests on
 * recomputing it exactly. Nothing else may import it, and when this
 * migration has run everywhere it can be deleted with the file.
 */
const OLD_SUMMARISED_FIELDS = ['body', 'steps', 'observations', 'extra'] as const;

/** `itemSummaryBasis` as it was before this ruling. Same canonicalisation,
 * `extra` un-narrowed. */
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
const unchanged: string[] = [];
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

  const nextBasis = itemSummaryBasis(item);
  if (nextBasis === item.summaryOf) { unchanged.push(item.id); continue; }

  // The byte-identity guard. `writeItem` renders the whole item, so a file
  // that does not already round-trip would come back reformatted by a
  // migration asked to move one line — and the difference would be invisible
  // in the summary below. Refuse it and name it instead.
  if (renderItem(item) !== raw) {
    refused.push(`${rel}: does not round-trip byte-identically; not rewritten`);
    continue;
  }

  item.summaryOf = nextBasis;
  if (apply) writeItem(root, item);
  restamped.push(item.id);
}

console.log(`root: ${root}`);
console.log(`${files.length} file(s); ${apply ? 'APPLIED' : 'DRY RUN — pass --apply to write'}`);
console.log(`  re-stamped (was current, stays current, basis moved):     ${restamped.length}`);
console.log(`  current already (extra held no excluded key):             ${unchanged.length}`);
// "Its recorded basis does not match the OLD formula", which before the
// migration means STALE and after it means ALREADY MIGRATED. Both are the
// same instruction — leave it alone — so they share a bucket, and the label
// says the predicate rather than one of its two causes. This is also what
// makes a second run a no-op: once every basis is a new-formula value,
// nothing here can match the old formula again.
console.log(`  left alone (basis is not an OLD-formula value):           ${leftStale.length}`);
for (const id of leftStale) console.log(`      ${id}`);
console.log(`  no summary, nothing to stamp:                             ${noSummary.length}`);
console.log(`  unanchored (summary, no basis):                           ${unanchored.length}`);
for (const id of unanchored) console.log(`      ${id}`);
if (refused.length > 0) {
  console.log(`  REFUSED — nothing written for these:                     ${refused.length}`);
  for (const line of refused) console.log(`      ${line}`);
}
