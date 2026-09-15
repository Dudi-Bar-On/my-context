/**
 * **A ONE-TIME backfill: a recommendation on the drafts that were captured
 * before the pass wrote one** — the owner's second ask on
 * `TASK-the-review-queue-explains-a-proposal-at-length-and-never`, in his
 * words:
 *
 *   *"you can backfill it now by reading every queue item and add the
 *   recommendation as it was written on capture time (a one time action, good
 *   for my reviewing tests)"*
 *
 * ── WHAT THIS CANNOT DO, SAID FIRST BECAUSE IT DECIDES THE REST ────────────
 *
 * It cannot add the recommendation *as it was written at capture time*,
 * because **nothing was written at capture time.** The pass held structured
 * fields — `evidence`, `sessionsSeen`, `target`, `claim` — and stored only
 * their PROSE RENDERING in the brief. The fields themselves are gone.
 *
 * So this is a RE-DERIVATION, on a later day, from the fields that happened to
 * survive on the draft itself:
 *
 *   - `scope` — the pass writes the target there, and ONLY when it is a file
 *     path (`propose.ts` · `proposal.target.includes('/')`). So a file target
 *     survived; an item target and no target at all are both an empty scope
 *     and are INDISTINGUISHABLE from each other.
 *   - the `confirmed` / `unconfirmed` tag — recurrence, exactly as recorded.
 *   - `summary` — a clip of the selected claim, which shows how the claim ends
 *     unless `clip` truncated it, in which case it ends in `…` and shows
 *     nothing. That is read as ABSENT, never as a verdict about the ending.
 *
 * And what did NOT survive is left absent: **how many evidence records were
 * cited, and how many sessions the claim was seen in.** Both are stated in the
 * brief's prose — *"Seen in ONE session only"*, *"Evidence: x.jsonl record
 * 297"* — and this module deliberately does not read them back out of it.
 *
 * ── WHY IT DOES NOT, WHEN THE SENTENCES ARE RIGHT THERE ────────────────────
 *
 * Because parsing a rendering back into the fields it was rendered from, and
 * then presenting the result as though it had been recorded, is a specific
 * defect with a name — and there is a draft about it standing in this very
 * queue:
 * `TASK-task-reconstruct-a-subject-from-a-passage-you-copied-without`.
 * Committing it knowingly, inside the change that is supposed to make this
 * screen more honest, would be worse than the gap it closes.
 *
 * `RecommendInput` is tri-state for exactly this: `null` is *not recorded*,
 * and `recommend` treats it as a question it could not ask — which is
 * `needs-you`, never a default.
 *
 * ── AND EVERY BACKFILLED ROW SAYS SO, ON THE ROW ───────────────────────────
 *
 * Two marks, both machine-readable, neither a matter of a reader noticing a
 * turn of phrase:
 *
 *   - `rec-backfilled:<YYYY-MM-DD>` in the tags, which `/api/review-queue`
 *     serves and the screen draws ABOVE the verdict;
 *   - a first line in the body that says the same thing in prose, naming what
 *     it was derived from and what was gone.
 *
 * A reader must be able to tell a row re-derived on 2026-09-15 from one
 * written at capture. After this runs, they can, in two independent places.
 *
 * ── SAFETY: IT WRITES ONLY WHERE IT IS ALLOWED TO ──────────────────────────
 *
 * Only under `<corpus>/.drafts/`, only files whose `origin` is `review`, and
 * only ones that carry no `rec:` tag already — so it is idempotent and can
 * never touch a natively captured row. Before any draft is changed, its
 * parse→render round trip is checked to be byte-identical; a file that does
 * not round-trip is REFUSED and reported rather than rewritten, because a
 * renderer that normalises something is a renderer that would silently edit a
 * draft nobody asked it to edit.
 *
 * Run it: `node src/review/backfill-recommendations.ts <corpusRoot> [--dry-run]`.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../core/paths.ts';
import { computeItemChecksum, parseItem, renderItem } from '../core/item.ts';
import { DRAFT_DIR } from '../core/drafts.ts';
import type { Item } from '../core/types.ts';
import {
  backfillNotice, backfillTag, claimShapeOfSummary, composeBody, recommend, recommendTag,
  splitRecommendation, verdictFromTags,
  type Recommendation, type RecommendInput,
} from './recommend.ts';

/** What the derivation is allowed to read, named for the row's own prose. */
const DERIVED_FROM =
  `this draft's own fields — its scope, its confirmed/unconfirmed tag, and its summary`;

export interface BackfillRow {
  id: string;
  filePath: string;
  /** `null` when the draft was skipped or refused. */
  recommendation: Recommendation | null;
  /** What was derived, for the report. */
  input: RecommendInput | null;
  /** `written`, `already-had-one`, `not-a-review-draft`, or a refusal. */
  outcome: string;
}

export interface BackfillResult {
  rows: BackfillRow[];
  written: number;
  skipped: number;
  refused: number;
}

/** Every `.md` under `<root>/.drafts/`, in a stable order. */
export function draftFiles(root: string): string[] {
  const base = path.join(root, DRAFT_DIR);
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
    }
  };
  walk(base);
  return out;
}

/**
 * The signals, read off a stored draft — and every one that did not survive
 * left `null`, with a sentence saying it was looked for.
 *
 * `repoRoot` is the repository, so a file target can be checked for existence.
 * That is the only signal here that is a fact about TODAY rather than about
 * the capture, and the row's prose says so.
 */
export function deriveInput(item: Item, repoRoot: string): RecommendInput {
  // **An empty `scope` is ambiguous and is reported as such.** The pass writes
  // `scope` only for a target containing `/`, so no-scope means EITHER the
  // proposal named an item id OR it named nothing — two different verdicts,
  // and the draft does not say which.
  const scoped = item.scope.length === 1 && item.scope[0]!.includes('/')
    ? item.scope[0]! : null;

  const confirmed = item.tags.includes('confirmed') ? true
    : item.tags.includes('unconfirmed') ? false : null;

  const claim = item.summary === null ? null : claimShapeOfSummary(item.summary);

  const absent: string[] = [
    'how many evidence records the proposal cited, and which transcript they came from',
    'how many sessions the claim was seen in',
  ];
  if (scoped === null) {
    absent.push(
      'whether this names an item in the corpus or names nothing at all — the pass writes a ' +
      'scope only for a file path, so an empty scope is both of those at once');
  }
  if (claim === null) {
    absent.push('how the selected sentence ends — the stored summary was clipped, so it does not show');
  }

  return {
    targetKind: scoped === null ? null : 'file',
    target: scoped,
    targetResolves: scoped === null ? null : existsSync(path.join(repoRoot, scoped)),
    claim,
    confirmed,
    sessionsSeen: null,
    evidenceCount: null,
    absent,
  };
}

/**
 * Do it. `dryRun` derives and reports everything and writes nothing, which is
 * how the spread was measured before a byte moved.
 */
export function backfill(
  corpusRoot: string, isoDate: string, dryRun: boolean,
): BackfillResult {
  const repoRoot = path.dirname(corpusRoot);
  const result: BackfillResult = { rows: [], written: 0, skipped: 0, refused: 0 };

  for (const file of draftFiles(corpusRoot)) {
    const before = readFileSync(file, 'utf8');
    const relative = path.relative(corpusRoot, file).split(path.sep).join('/');
    let item: Item;
    try {
      item = parseItem(before, relative, 'project');
    } catch (error) {
      result.refused++;
      result.rows.push({
        id: relative, filePath: relative, recommendation: null, input: null,
        outcome: `REFUSED: it does not parse — ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    if (item.origin !== 'review') {
      result.skipped++;
      result.rows.push({
        id: item.id, filePath: relative, recommendation: null, input: null,
        outcome: 'skipped: not a review-pass draft, so no pass ever owed it a recommendation',
      });
      continue;
    }
    if (verdictFromTags(item.tags) !== null) {
      result.skipped++;
      result.rows.push({
        id: item.id, filePath: relative, recommendation: null, input: null,
        outcome: 'skipped: it already carries a recommendation, so this is not its first backfill',
      });
      continue;
    }
    if (splitRecommendation(item.body).why !== null) {
      result.refused++;
      result.rows.push({
        id: item.id, filePath: relative, recommendation: null, input: null,
        outcome: 'REFUSED: the body already carries a recommendation block but no rec: tag — ' +
          'a half-written state this must not paper over',
      });
      continue;
    }

    // **The round trip, checked before anything is changed.** If rendering an
    // untouched parse does not reproduce the file byte for byte, then writing
    // this item back would also change something nobody asked to change, and
    // the honest move is to refuse the file and say so.
    if (renderItem(item) !== before) {
      result.refused++;
      result.rows.push({
        id: item.id, filePath: relative, recommendation: null, input: null,
        outcome: 'REFUSED: parse → render is not byte-identical for this file, so a write here ' +
          'would silently normalise something beyond the backfill',
      });
      continue;
    }

    const input = deriveInput(item, repoRoot);
    const recommendation = recommend(input);
    const row: BackfillRow = {
      id: item.id, filePath: relative, recommendation, input,
      outcome: dryRun ? 'would write' : 'written',
    };
    result.rows.push(row);

    if (dryRun) { result.written++; continue; }

    item.tags = [...item.tags, recommendTag(recommendation.verdict), backfillTag(isoDate)];
    // **Through `composeBody`, never by hand.** It owns the order — notice,
    // reason, signals, marker, brief — and the marker text the read model
    // splits on. A second spelling here is how the two would drift.
    //
    // The BRIEF passed in is `item.body` untouched: the existing draft body is
    // the brief, and the backfill adds above it without editing one byte of it.
    item.body = composeBody(recommendation, item.body, backfillNotice(isoDate, DERIVED_FROM));
    item.checksum = computeItemChecksum(item);
    writeFileSync(file, renderItem(item), 'utf8');
    result.written++;
  }
  return result;
}

// ── THE COMMAND LINE ────────────────────────────────────────────────────────

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const root = args.find((a) => !a.startsWith('--'));
  if (root === undefined) {
    process.stderr.write(
      'usage: node src/review/backfill-recommendations.ts <corpusRoot> [--dry-run]\n');
    process.exit(2);
  }
  const isoDate = new Date().toISOString().slice(0, 10);
  const out = backfill(root, isoDate, dryRun);
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.stdout.write(
    `\n${dryRun ? 'would write' : 'written'}: ${out.written}; skipped: ${out.skipped}; ` +
    `refused: ${out.refused}\n`);
  const spread: Record<string, number> = {};
  for (const row of out.rows) {
    if (row.recommendation === null) continue;
    spread[row.recommendation.verdict] = (spread[row.recommendation.verdict] ?? 0) + 1;
  }
  process.stdout.write(`spread: ${JSON.stringify(spread)}\n`);
}
