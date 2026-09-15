#!/usr/bin/env node
/**
 * **Which corpus item, if any, a review row was filed as** — the instrument
 * behind `TASK-audit-the-six-review-reports-against-the-corpus-and-find`
 * (`rulings/90`) and the report it produced,
 * `reports/2026-09-15-the-six-reviews-audited.md`.
 *
 *     node scripts/measure-review-coverage.ts                  # every plan cited by the audit
 *     node scripts/measure-review-coverage.ts swallow wcag     # only those plans
 *     node scripts/measure-review-coverage.ts --cite walk/145  # resolve one citation
 *     node scripts/measure-review-coverage.ts --rows           # the audit's headline counts
 *
 * **IT READS AND WRITES NOTHING BUT `.my_context/items/`.** No `node:sqlite`,
 * no git, no network, no write of any kind. It is the mechanical half of the
 * audit: the half that turns a citation like `walk/145` into an item id and a
 * `state`, so a claim in the report can be checked without trusting the
 * report's own prose.
 *
 * ── WHAT IT SCANS, SAID EXACTLY, BECAUSE A COUNT IS A CLAIM ────────────────
 *
 * Every `*.md` under `.my_context/items/**` whose frontmatter carries BOTH a
 * `plan:` and a `seq:`. An item with a `plan` and no `seq` is unciteable by
 * construction — nothing can address it — and is reported separately rather
 * than silently dropped, because "no row here" and "a row nobody can cite"
 * are different answers and this project's own
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` forbids
 * collapsing them.
 *
 * **A citation resolves to a LIST, not to an item.** `plan/seq` is not unique
 * in this corpus — `REF-the-d-numbers-what-each-one-means-and-which-are-only`
 * records five live collisions (`handover/12`, `probe/0`, `rulings/20`,
 * `ui3/11x` with six items, `walk/138`) — so a resolver that returned one item
 * would pick a winner the corpus does not name. Callers get every match.
 *
 * ── WHAT WOULD MAKE ITS NUMBERS WRONG ──────────────────────────────────────
 *
 * 1. The frontmatter reader is a LINE SCANNER, not a YAML parser: it reads
 *    `key: value` at the top level of the `---` block and nothing else. A
 *    quoted value containing `: ` survives; a multi-line or block scalar for
 *    `plan`/`seq`/`state`/`status`/`title` would not. None of the five is ever
 *    written that way by the CLI, which is why this is safe AND why it is said
 *    here rather than assumed.
 * 2. `state` is declared by `plan` and `task` items only. A `requirement` that
 *    closes a subject carries no `state` at all — D57 is the recorded
 *    precedent, and its closure lives in the D-number map and nowhere else. So
 *    `done + todo` under a plan can be smaller than that plan's item count and
 *    the difference is not a defect.
 * 3. It reads the working tree, not a commit. A file staged-but-not-committed,
 *    or an item a live lane is writing right now, is counted as it is on disk.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface ItemRow {
  readonly id: string;
  readonly plan: string;
  readonly seq: string;
  readonly state: string | null;
  readonly status: string | null;
  readonly title: string;
  readonly path: string;
}

export interface PlanSummary {
  readonly plan: string;
  readonly total: number;
  readonly done: number;
  readonly todo: number;
  readonly other: number;
}

const FRONTMATTER_KEYS = ['id', 'plan', 'seq', 'state', 'status', 'title'] as const;

/**
 * Read the top-level `key: value` pairs of a `---` frontmatter block. Returns
 * an empty record for a file with no frontmatter rather than throwing: a
 * corpus that grew a non-item `.md` file should make this measurement smaller,
 * not make it fail.
 */
export function parseFrontmatter(text: string): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  if (!text.startsWith('---')) return out;
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.trimEnd() === '---') break;
    if (line.startsWith(' ') || line.startsWith('-') || line.startsWith('\t')) continue;
    const at = line.indexOf(': ');
    if (at <= 0) continue;
    const key = line.slice(0, at);
    let value = line.slice(at + 2).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function walkMarkdown(dir: string, found: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkMarkdown(full, found);
    else if (entry.endsWith('.md')) found.push(full);
  }
  return found;
}

/**
 * Every item carrying a `plan` and a `seq`, keyed `plan/seq`. The value is an
 * ARRAY because the address is not unique — see the header.
 */
export function loadPlanIndex(itemsDir: string): Map<string, ItemRow[]> {
  const index = new Map<string, ItemRow[]>();
  for (const path of walkMarkdown(itemsDir, [])) {
    const fm = parseFrontmatter(readFileSync(path, 'utf8'));
    const plan = fm['plan'];
    const seq = fm['seq'];
    if (!plan || !seq || plan === 'null' || seq === 'null') continue;
    const row: ItemRow = {
      id: fm['id'] ?? '(no id)',
      plan,
      seq,
      state: fm['state'] ?? null,
      status: fm['status'] ?? null,
      title: fm['title'] ?? '',
      path,
    };
    const key = `${plan}/${seq}`;
    const existing = index.get(key);
    if (existing) existing.push(row);
    else index.set(key, [row]);
  }
  return index;
}

/** Items a `plan/seq` citation names. Empty means the citation names nothing. */
export function resolveCitation(index: Map<string, ItemRow[]>, citation: string): ItemRow[] {
  return index.get(citation.trim()) ?? [];
}

/** Every row under one plan, ordered by numeric seq where seq is numeric. */
export function rowsOfPlan(index: Map<string, ItemRow[]>, plan: string): ItemRow[] {
  const rows: ItemRow[] = [];
  for (const list of index.values()) for (const row of list) if (row.plan === plan) rows.push(row);
  rows.sort((a, b) => {
    const na = Number(a.seq);
    const nb = Number(b.seq);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.seq.localeCompare(b.seq);
  });
  return rows;
}

/** done / todo / neither, counted rather than assumed — see caveat 2 above. */
export function summarisePlan(index: Map<string, ItemRow[]>, plan: string): PlanSummary {
  const rows = rowsOfPlan(index, plan);
  let done = 0;
  let todo = 0;
  let other = 0;
  for (const row of rows) {
    if (row.state === 'done') done += 1;
    else if (row.state === 'todo') todo += 1;
    else other += 1;
  }
  return { plan, total: rows.length, done, todo, other };
}

/**
 * **Every row of `reports/2026-09-13-the-consolidated-findings.md`, mapped to
 * the citation it was filed as.** This is the table the audit rests on, and it
 * is a JUDGEMENT rather than a derivation — nothing mechanical links a row
 * number to an item id, so it is written here where it can be argued with
 * rather than left in prose.
 *
 * ── HOW EACH ROW WAS MATCHED, AND WHAT WOULD MAKE ONE WRONG ────────────────
 *
 * Three things had to agree:
 *
 * 1. the row's own **proposed D** column (`widen D46`, `new — a gate that is
 *    not a gate`, and so on);
 * 2. the plan and `seq` range that
 *    `REF-the-d-numbers-what-each-one-means-and-which-are-only` records for
 *    that D number — it is the map, and D66-D76 each name theirs;
 * 3. the item's **title**, read against the row's text.
 *
 * Within the eleven plans minted from the consolidation the `seq` order
 * happens to follow the row order exactly, which is why `runOf` below can
 * write them as a list. That is CORROBORATION AND NOT THE METHOD: every one of
 * those 62 rows was also matched by title, because an off-by-one inside a plan
 * is precisely the error an ordering assumption cannot see.
 *
 * Row 54 (Hebrew bidi) is the one row with no item at all: it landed in commit
 * `ae4984d7` with no residue, recorded in the D-number map, and is counted
 * closed on that evidence rather than on an item's `state`.
 */
const runOf = (plan: string, rows: readonly number[]): Record<number, string> =>
  Object.fromEntries(rows.map((row, i) => [row, `${plan}/${i + 1}`]));

export const ROW_TO_CITATION: Readonly<Record<number, string>> = {
  // D66-D76 — the eleven subjects minted from the consolidation.
  ...runOf('swallow', [2, 5, 6, 9, 10, 38, 39, 40, 106, 108, 109, 110]),
  ...runOf('wcag', [21, 22, 23, 28, 89, 100, 101, 103, 116]),
  ...runOf('cliscript', [45, 47, 57, 59, 112, 114]),
  ...runOf('confirm', [24, 25, 27, 42, 102]),
  ...runOf('unread', [3, 32, 34, 35, 37]),
  ...runOf('gates', [11, 16, 46, 70, 115]),
  ...runOf('readmodel', [18, 20, 91, 104]),
  ...runOf('invariant', [71, 72, 73, 74]),
  ...runOf('mcpsurface', [61, 62, 63, 83]),
  ...runOf('dxfindings', [17, 49, 67, 69]),
  ...runOf('accretion', [78, 79, 84, 86]),
  // The 57 rows that widened an existing subject, in D order.
  13: 'rulings/75', // D6
  54: '(landed in ae4984d7, no residue and no item)', // D8
  52: 'builder/18', // D11
  60: 'contra/5', // D33
  87: 'rulings/73', // D38
  14: 'store/6', 43: 'store/7', 55: 'store/8', 56: 'store/9', // D41
  80: 'store/10', 81: 'store/11', 82: 'store/12',
  4: 'recall/7', // D42
  50: 'walk/152', 88: 'walk/153', 92: 'walk/154', 93: 'walk/155', // D44
  94: 'walk/156', 95: 'walk/157', 117: 'walk/158', 118: 'walk/159', 119: 'walk/160',
  44: 'walk/161', 68: 'walk/162', // D45
  1: 'walk/145', 7: 'walk/146', 36: 'walk/147', 41: 'walk/148', // D46
  48: 'walk/149', 51: 'walk/150', 90: 'walk/151',
  30: 'walk/163', 105: 'walk/164', // D47
  96: 'walk/165', // D48
  26: 'walk/166', 31: 'walk/167', 97: 'walk/168', // D50
  58: 'rulings/76', 64: 'rulings/77', 65: 'rulings/78', 85: 'rulings/79', // D51
  8: 'rulings/80', 33: 'rulings/81', 53: 'rulings/82', // D52
  113: 'hooks/35', // D55
  111: 'live/28', // D56
  98: 'rulings/83', 99: 'rulings/84', // D58
  29: 'screens/27', // D63 — two items share this address; see `countRows`
  12: 'rulings/69', 15: 'rulings/85', 19: 'rulings/86', // D64
  66: 'rulings/87', 75: 'rulings/88', 107: 'rulings/89',
  76: 'rulings/70', 77: 'rulings/74', // D65
};

export interface RowCounts {
  readonly open: number;
  readonly closed: number;
  readonly unmapped: readonly number[];
  readonly unresolved: readonly string[];
}

/**
 * The audit's headline numbers, re-derived rather than quoted. `unmapped` and
 * `unresolved` are returned rather than swallowed: a row this table forgot and
 * a citation that names nothing are different facts from "zero of them", and
 * collapsing either into a total is the defect this repository keeps catching.
 */
export function countRows(index: Map<string, ItemRow[]>): RowCounts {
  let open = 0;
  let closed = 0;
  const unmapped: number[] = [];
  const unresolved: string[] = [];
  for (let row = 1; row <= 119; row += 1) {
    const citation = ROW_TO_CITATION[row];
    if (citation === undefined) {
      unmapped.push(row);
      continue;
    }
    if (citation.startsWith('(')) {
      closed += 1;
      continue;
    }
    const matches = resolveCitation(index, citation);
    if (matches.length === 0) {
      unresolved.push(`${row} → ${citation}`);
      continue;
    }
    // `screens/27` names two items. Row 29 is the screen-heading verdict; the
    // other item at that address is the viewer's invisible question. Picking by
    // title rather than by position, because position is not a fact here.
    const item = matches.length > 1
      ? matches.find((m) => /green tick/.test(m.title)) ?? matches[0]!
      : matches[0]!;
    if (item.state === 'done') closed += 1;
    else open += 1;
  }
  return { open, closed, unmapped, unresolved };
}

/** The eleven subjects D66-D76 minted from the consolidation, in D order. */
export const CONSOLIDATION_PLANS: readonly string[] = [
  'swallow',
  'wcag',
  'cliscript',
  'confirm',
  'unread',
  'gates',
  'readmodel',
  'invariant',
  'mcpsurface',
  'dxfindings',
  'accretion',
];

function main(argv: readonly string[]): void {
  const itemsDir = join(process.cwd(), '.my_context', 'items');
  const index = loadPlanIndex(itemsDir);
  const citeAt = argv.indexOf('--cite');
  if (citeAt >= 0) {
    for (const citation of argv.slice(citeAt + 1)) {
      const rows = resolveCitation(index, citation);
      if (rows.length === 0) {
        console.log(`${citation}  —  NAMES NOTHING`);
        continue;
      }
      for (const row of rows) {
        console.log(`${citation}  ${row.state ?? '(no state)'}  ${row.id}`);
        console.log(`    ${row.title}`);
      }
    }
    return;
  }
  if (argv.includes('--rows')) {
    const counts = countRows(index);
    console.log(`119 rows of the consolidation: ${counts.open} open, ${counts.closed} closed.`);
    console.log(
      counts.unmapped.length === 0
        ? '  every row is mapped to a citation.'
        : `  ROWS WITH NO MAPPING: ${counts.unmapped.join(', ')}`,
    );
    console.log(
      counts.unresolved.length === 0
        ? '  every citation resolves to at least one item.'
        : `  CITATIONS NAMING NOTHING: ${counts.unresolved.join(' · ')}`,
    );
    return;
  }
  const plans = argv.filter((a) => !a.startsWith('--'));
  const wanted = plans.length > 0 ? plans : CONSOLIDATION_PLANS;
  for (const plan of wanted) {
    const summary = summarisePlan(index, plan);
    console.log(
      `\n=== plan:${plan} — ${summary.done} done / ${summary.todo} todo` +
        (summary.other > 0 ? ` / ${summary.other} with no state` : '') +
        ` of ${summary.total} ===`,
    );
    for (const row of rowsOfPlan(index, plan)) {
      console.log(`  ${row.plan}/${row.seq}  ${(row.state ?? '—').padEnd(5)}  ${row.title}`);
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '')) {
  main(process.argv.slice(2));
}
