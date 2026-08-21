#!/usr/bin/env node
/**
 * **Citations resolve, or this exits 1.**
 *
 * The three web-UI plans went stale silently. Their base commits are not
 * ancestors of `master`, 186 `file:line` citations drifted with them, and the
 * first two sampled were off by 136 and 42 lines — landing mid-comment in
 * unrelated code. Nothing noticed, because nothing was checking.
 *
 * `INV-nothing-is-dropped-silently` is this project's rule for exactly that
 * shape. A citation that quietly stops resolving is that invariant's own
 * failure, one layer up in the documentation. So the citation form carries a
 * VERBATIM source fragment, and this script resolves every one of them.
 *
 * The form (`2026-08-18-v2-decisions.md` §2):
 *
 *     `select.ts` · `export function select(` · ~460
 *      ^ file       ^ verbatim fragment          ^ hint, allowed to be stale
 *
 * The fragment is the identity; the line is a convenience. A refactor that
 * moves code updates the hint (`--fix`) and stays green. A change that
 * deletes or rewrites the cited code turns the citation red — which is the
 * failure you actually want surfaced, and the one a line number cannot
 * distinguish from a harmless shift.
 *
 * **THE ONE EXCEPTION: a document that quotes the past on purpose.**
 *
 * A plan's §0 correction log and its §7 survey quote the PRE-change text
 * verbatim — `test('there are 21 categories', …)` against a catalogue that has
 * since gone to 24. Re-anchoring those to the post-change text would make the
 * survey false and contradict the correction log printed beside it. But to a
 * fragment resolver they are indistinguishable from a stale pointer, so every
 * plan that surveys prior state reddens this gate permanently — and a gate
 * that is always red stops being read, which is the same failure this script
 * exists to prevent one layer down.
 *
 * So a citation may declare itself a historical quotation:
 *
 *     | Both READMEs' counts | `README.md` · `holds **21** categories` · ~3789 <!-- historical-citation: §7 quotes the pre-24 text; Task 2 changes it --> |
 *
 * **The marker's scope is the LINE it sits on, and nothing wider.** A section-
 * or document-level fence would be four edits instead of sixteen, and it is
 * the wrong trade twice over. Its blast radius grows in silence — a task
 * appended below the fence goes unchecked and nothing says so — and, worse, it
 * can never go stale: a section holding forty citations of which three are
 * historical keeps the marker "used" forever, so the day those three stop
 * being historical, nothing notices. At line scope, rule 1 below has teeth.
 *
 * **A marker is not a suppressor. Three rules keep it from becoming one:**
 *
 *   1. **It must excuse something.** A marker on a line whose citations all
 *      resolve — or on a line carrying no citation at all — is itself an error
 *      and fails the run. You cannot pre-arm one against a future break, and
 *      one left behind after the quoted text comes back turns red rather than
 *      hiding the next drift underneath itself.
 *   2. **It must be well formed.** Missing reason, missing colon, unterminated
 *      or misspelled is reported as a fault AND leaves its citations judged as
 *      normal — a mangled marker fails twice rather than swallowing once.
 *   3. **It excuses a missing FRAGMENT only** — never a missing file, never an
 *      ambiguous one. The fragment is the historical claim. A path that
 *      resolves nowhere is indistinguishable from a typo, and history is not
 *      an excuse a typo gets to borrow.
 *
 * There is deliberately no `--fix` for markers, and never should be: a flag
 * that writes suppressions is the blanket suppressor, automated.
 *
 * **THE SECOND FAULT: a separator this script could not read.**
 *
 * `CITATION` joins the three parts with `[ \t]*·[ \t]*` — spaces and tabs, and
 * no newline. A citation already written in the checked form but WRAPPED
 * across two source lines therefore matches nothing. It is not BROKEN. It is
 * invisible: never counted, never resolved, reported nowhere — which is worse
 * than the failure the form was built to end, because it wears the form's own
 * clothes. Twenty-two were found by hand on 2026-08-21, and ten of them came
 * back MOVED the instant the gate could see them.
 *
 * So a `·` that `CITATION` did NOT consume, standing where a citation
 * separator stands, is a fault. There is no third reading of it in this
 * corpus: it is a wrapped citation or a malformed one, and both are things
 * the author believes are checked and are not. Four shapes, all of them real:
 *
 *     `core/search.ts` ·                     ← the fragment is on the next line
 *     `core/inject.ts` · `this selection is  ← the fragment is cut mid-span
 *     `check-retired.ts` · `// watching …` · ← the `~100` is on the next line
 *     · ~8 lists `clear` as a `source` value ← the hint left behind by the above
 *
 * A `·` used as ordinary punctuation is untouched, and the discrimination is
 * not a heuristic: `Profiles: `minimal` (8) · `standard` (17)` has no cited
 * FILE on its left, ``Citations are `file` · `fragment` · `~line``` names no
 * extension, and `**Roadmap:** `docs/ROADMAP.md` · **Reviews:** …` does cite a
 * file but is followed by prose rather than by a fragment or a line ending —
 * the one place a wrapped citation can put its other half.
 *
 * Zero dependencies, no build step, erasable syntax only — the same
 * constraints as `src/`.
 *
 * Usage:
 *   node scripts/verify-citations.ts            check, exit 1 on any miss
 *   node scripts/verify-citations.ts --fix      also rewrite stale ~line hints
 *   node scripts/verify-citations.ts --json     machine-readable report
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

/** Documents whose citations are checked. Everything under these, recursively. */
const DOC_ROOTS = ['docs/superpowers/specs', 'docs/superpowers/plans', 'docs/design'];

/** Where a bare `select.ts` may be resolved from, in priority order. */
const SEARCH_ROOTS = ['src', 'test', 'scripts', 'docs', '.'];

/**
 * `` `file` · `fragment` · ~line ``, where the fragment may itself contain
 * backticks and is then written as a ``double-backtick span``. The `~line` is
 * optional: a citation may carry the fragment alone.
 */
const CITATION =
  /`([^`\n]+?\.(?:ts|js|mjs|cjs|md|json))`[ \t]*·[ \t]*(?:``(.+?)``|`([^`\n]+?)`)(?:[ \t]*·[ \t]*~(\d+))?/g;

/**
 * `<!-- historical-citation: why -->`, matched a line at a time because one
 * line is the marker's entire scope.
 *
 * TWO regexes rather than one, and that is the point of them. `OPEN` finds
 * anything that was TRYING to be a marker; `FULL` decides whether it managed
 * it. A single strict pattern would let `<!-- historical-citations: … -->` or
 * a marker whose `-->` wrapped onto the next line fall through as "no marker
 * here", leaving the author staring at a citation they believe they excused
 * and a checker that never mentions the thing they wrote.
 */
const MARKER_OPEN = /<!--[ \t]*historical-citation/g;
const MARKER_FULL = /^<!--[ \t]*historical-citation[ \t]*:[ \t]*(\S.*?)[ \t]*-->/;

/** The separator `CITATION` looks for, on its own, so the leftovers can be found. */
const SEPARATOR = '·';

/**
 * A cited FILE sitting at the end of the text to the left of a separator —
 * the same `` `name.ts` `` shape `CITATION` opens with, anchored. This, and
 * not "a backtick", is what tells a citation apart from prose that happens to
 * punctuate with `·`.
 */
const CITED_FILE_AT_END = /`[^`\n]+?\.(?:ts|js|mjs|cjs|md|json)`$/;

/** A `~460` line hint at the start of the text to the right of a separator. */
const HINT_AT_START = /^~\d/;

interface Citation {
  doc: string;
  docLine: number;
  file: string;
  fragment: string;
  hint: number | null;
  raw: string;
}

/** A well-formed `<!-- historical-citation: … -->`, and the line it governs. */
interface Marker {
  doc: string;
  docLine: number;
  reason: string;
}

/**
 * Something this script refuses to pass over in silence, and why. Every fault
 * fails the run. Nothing here is a warning.
 *
 * `MARKER` — a marker that is not doing its job: either suppressing something
 * it should not, or claiming to suppress something that does not exist. Both
 * are the failure the marker was added to avoid.
 *
 * `UNREAD` — a `·` standing where a citation separator stands that `CITATION`
 * did not consume: a wrapped or malformed citation, which is the failure the
 * citation form was added to avoid.
 *
 * One list, one counter, one exit code. A second reporting channel would be a
 * second place to stop reading.
 */
interface Fault {
  doc: string;
  docLine: number;
  label: 'MARKER' | 'UNREAD';
  raw: string;
  why: string;
}

type Verdict =
  | { kind: 'ok'; at: number }
  | { kind: 'moved'; at: number }
  | { kind: 'ambiguous'; at: number; count: number }
  | { kind: 'no-file' }
  | { kind: 'no-match' }
  | { kind: 'historical'; reason: string };

function walk(dir: string, out: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * A citation names `select.ts`, not `src/core/select.ts`, because the short
 * form survives a directory move and reads better in a table. Resolution is
 * therefore a suffix match, and an AMBIGUOUS suffix is an error rather than a
 * guess — two files named `index.ts` must not silently resolve to whichever
 * the walk reached first.
 */
const fileIndex = new Map<string, string[]>();

function indexFiles(): void {
  const push = (rel: string) => {
    const norm = rel.split(path.sep).join('/');
    for (const key of suffixKeys(norm)) {
      const list = fileIndex.get(key);
      if (list) list.push(norm);
      else fileIndex.set(key, [norm]);
    }
  };
  const walkAll = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === '.my_context') continue;
      const full = path.join(dir, entry);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) walkAll(full);
      else push(path.relative(REPO, full));
    }
  };
  walkAll(REPO);
}

/** `src/core/select.ts` → ['select.ts', 'core/select.ts', 'src/core/select.ts'] */
function suffixKeys(rel: string): string[] {
  const parts = rel.split('/');
  const keys: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) keys.push(parts.slice(i).join('/'));
  return keys;
}

function resolveFile(cited: string): string[] {
  const direct = path.join(REPO, cited);
  try {
    if (statSync(direct).isFile()) return [cited];
  } catch {
    /* fall through to the suffix index */
  }
  const hits = fileIndex.get(cited) ?? [];
  if (hits.length <= 1) return hits;
  // Prefer the earliest SEARCH_ROOT, so `select.ts` resolves to src/ over a
  // same-named fixture in test/. Ties beyond that stay ambiguous on purpose.
  const ranked = hits.slice().sort((a, b) => rank(a) - rank(b));
  const best = rank(ranked[0]!);
  const tied = ranked.filter((h) => rank(h) === best);
  return tied.length === 1 ? [ranked[0]!] : tied;
}

function rank(rel: string): number {
  for (let i = 0; i < SEARCH_ROOTS.length; i++) {
    const root = SEARCH_ROOTS[i]!;
    if (root === '.' || rel.startsWith(`${root}/`)) return i;
  }
  return SEARCH_ROOTS.length;
}

/**
 * Markdown escapes `|` inside a table cell. The fragment is compared against
 * SOURCE, so the escape has to come off first — otherwise every citation in a
 * table whose fragment contains a union type is a false negative.
 */
function unescapeFragment(fragment: string): string {
  return fragment.replace(/\\\|/g, '|').replace(/\\`/g, '`');
}

function findFragment(fileRel: string, fragment: string): number[] {
  let text: string;
  try {
    text = readFileSync(path.join(REPO, fileRel), 'utf8');
  } catch {
    return [];
  }
  const needle = unescapeFragment(fragment).trim();
  if (needle.length === 0) return [];
  const lines = text.split(/\r?\n/);
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(needle)) hits.push(i + 1);
  }
  return hits;
}

interface DocScan {
  citations: Citation[];
  markers: Marker[];
  faults: Fault[];
}

/**
 * Every `<!-- historical-citation … -->` on one line, sorted into the ones
 * this script will honour and the ones it refuses to.
 *
 * A SECOND marker on a line is a fault rather than a redundancy. One marker
 * already covers the whole line, so a second can only mean its author thought
 * markers attach to individual citations — and someone who believes that will
 * eventually leave one attached to nothing, which is the habit rule 1 exists
 * to break.
 */
function scanMarkers(doc: string, docLine: number, line: string, out: DocScan): void {
  MARKER_OPEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  let honoured = 0;
  while ((m = MARKER_OPEN.exec(line)) !== null) {
    const rest = line.slice(m.index);
    const full = MARKER_FULL.exec(rest);
    if (full === null) {
      // `MARKER_OPEN` has already advanced `lastIndex` past its own match, so
      // the loop makes progress without touching it here.
      out.faults.push({
        doc,
        docLine,
        label: 'MARKER',
        raw: rest.slice(0, 72),
        why: 'malformed — the form is `<!-- historical-citation: why -->`, closed on one line, with a reason',
      });
      continue;
    }
    honoured++;
    if (honoured > 1) {
      out.faults.push({
        doc,
        docLine,
        label: 'MARKER',
        raw: full[0]!,
        why: 'a second marker on one line — one marker already covers every citation on the line',
      });
    } else {
      out.markers.push({ doc, docLine, reason: full[1]! });
    }
    MARKER_OPEN.lastIndex = m.index + full[0]!.length;
  }
}

/**
 * Why a `·` that `CITATION` walked past cannot be ordinary punctuation, or
 * `null` if it can.
 *
 * `left` is everything before the separator with trailing blanks removed;
 * `right` is everything after it with leading blanks removed. A wrapped
 * citation is exactly the case where ONE of the three parts is here and the
 * next part is not — because it is on the next line, where `[ \t]*·[ \t]*`
 * cannot follow it.
 */
function diagnoseSeparator(left: string, right: string): string | null {
  if (CITED_FILE_AT_END.test(left) && (right.length === 0 || right.startsWith('`'))) {
    return right.length === 0
      ? 'a cited file, then a separator, then the end of the line — the fragment is on the next line, ' +
          'where the gate cannot follow it. Join the citation onto one line.'
      : 'a cited file, then a separator, then a code span the citation form did not match — the fragment ' +
          'is cut across two lines. Join the citation onto one line.';
  }
  if (HINT_AT_START.test(right)) {
    return 'a `~line` hint that no citation on this line claimed — its file and fragment are on the line ' +
      'above, so the citation was read without its hint and this text is dead. Join it onto one line.';
  }
  if (right.length === 0 && left.endsWith('`')) {
    return 'a separator closing the line straight after a code span — whatever it separates is on the next ' +
      'line, where the gate cannot follow it. Join the citation onto one line.';
  }
  if (left.length === 0 && right.startsWith('`')) {
    return 'a separator opening the line straight before a code span — whatever it separates is on the ' +
      'previous line, where the gate cannot follow it. Join the citation onto one line.';
  }
  return null;
}

/**
 * Every `·` on one line that `CITATION` did not consume, judged.
 *
 * `spans` are the half-open ranges the citation matches occupied. A separator
 * inside one of them was read and is not this function's business; a separator
 * outside all of them was read by nobody, and INV-nothing-is-dropped-silently
 * is the rule that says an unread thing standing in a citation's place has to
 * be said out loud rather than skipped.
 */
function scanSeparators(
  doc: string,
  docLine: number,
  line: string,
  spans: Array<[number, number]>,
  out: DocScan,
): void {
  for (let i = line.indexOf(SEPARATOR); i !== -1; i = line.indexOf(SEPARATOR, i + 1)) {
    if (spans.some(([start, end]) => i >= start && i < end)) continue;
    const left = line.slice(0, i).replace(/[ \t]+$/, '');
    const right = line.slice(i + 1).replace(/^[ \t]+/, '');
    const why = diagnoseSeparator(left, right);
    if (why === null) continue;
    out.faults.push({
      doc,
      docLine,
      label: 'UNREAD',
      raw: `${left.length > 40 ? `…${left.slice(-40)}` : left} ${SEPARATOR} ${right.slice(0, 40)}`.trim(),
      why,
    });
  }
}

function collect(doc: string): DocScan {
  const text = readFileSync(doc, 'utf8');
  const lines = text.split(/\r?\n/);
  const rel = path.relative(REPO, doc).split(path.sep).join('/');
  const out: DocScan = { citations: [], markers: [], faults: [] };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    CITATION.lastIndex = 0;
    let m: RegExpExecArray | null;
    const spans: Array<[number, number]> = [];
    while ((m = CITATION.exec(line)) !== null) {
      spans.push([m.index, m.index + m[0]!.length]);
      out.citations.push({
        doc: rel,
        docLine: i + 1,
        file: m[1]!,
        fragment: m[2] ?? m[3]!,
        hint: m[4] ? Number(m[4]) : null,
        raw: m[0]!,
      });
    }
    scanSeparators(rel, i + 1, line, spans, out);
    scanMarkers(rel, i + 1, line, out);
  }
  return out;
}

function judge(c: Citation): Verdict {
  const resolved = resolveFile(c.file);
  if (resolved.length === 0) return { kind: 'no-file' };
  if (resolved.length > 1) {
    const hits = findFragment(resolved[0]!, c.fragment);
    return { kind: 'ambiguous', at: hits[0] ?? 0, count: resolved.length };
  }
  const hits = findFragment(resolved[0]!, c.fragment);
  if (hits.length === 0) return { kind: 'no-match' };
  const at = c.hint !== null && hits.includes(c.hint) ? c.hint : hits[0]!;
  if (c.hint === null || c.hint === at) return { kind: 'ok', at };
  return { kind: 'moved', at };
}

function main(): number {
  const argv = process.argv.slice(2);
  const fix = argv.includes('--fix');
  const asJson = argv.includes('--json');

  indexFiles();

  const docs: string[] = [];
  for (const root of DOC_ROOTS) walk(path.join(REPO, root), docs);
  docs.sort();

  const rows: Array<{ c: Citation; v: Verdict }> = [];
  const markers: Marker[] = [];
  const faults: Fault[] = [];
  for (const doc of docs) {
    const scan = collect(doc);
    for (const c of scan.citations) rows.push({ c, v: judge(c) });
    markers.push(...scan.markers);
    faults.push(...scan.faults);
  }

  // Markers are applied AFTER judging, never instead of it, so a marked
  // citation is still resolved against the tree and can still come back green
  // on its own. `no-match` is the only verdict a marker may convert — see
  // rule 3 in the contract at the top of this file.
  const at = (doc: string, line: number): string => `${doc}:${line}`;
  const byLine = new Map<string, Marker>();
  for (const mk of markers) byLine.set(at(mk.doc, mk.docLine), mk);
  const excused = new Map<string, number>();
  for (const r of rows) {
    if (r.v.kind !== 'no-match') continue;
    const mk = byLine.get(at(r.c.doc, r.c.docLine));
    if (mk === undefined) continue;
    r.v = { kind: 'historical', reason: mk.reason };
    const key = at(mk.doc, mk.docLine);
    excused.set(key, (excused.get(key) ?? 0) + 1);
  }

  // Rule 1, and the whole reason the marker is line-scoped: a marker that
  // excused nothing is reported and fails. It cannot be pre-armed against a
  // break that has not happened, and it cannot outlive the break it was
  // written for.
  for (const mk of markers) {
    if ((excused.get(at(mk.doc, mk.docLine)) ?? 0) > 0) continue;
    faults.push({
      doc: mk.doc,
      docLine: mk.docLine,
      label: 'MARKER',
      raw: `<!-- historical-citation: ${mk.reason} -->`,
      why:
        'excuses nothing on this line — every citation here resolves, the line carries none at all, ' +
        'or the failure is a missing FILE rather than a missing fragment',
    });
  }
  faults.sort((a, b) => (a.doc === b.doc ? a.docLine - b.docLine : a.doc < b.doc ? -1 : 1));

  const broken = rows.filter((r) => r.v.kind === 'no-file' || r.v.kind === 'no-match');
  const moved = rows.filter((r) => r.v.kind === 'moved');
  const ambiguous = rows.filter((r) => r.v.kind === 'ambiguous');
  const historical = rows.filter((r) => r.v.kind === 'historical');

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          checked: rows.length,
          documents: docs.length,
          broken: broken.map((r) => ({ ...r.c, verdict: r.v })),
          moved: moved.map((r) => ({ ...r.c, verdict: r.v })),
          ambiguous: ambiguous.map((r) => ({ ...r.c, verdict: r.v })),
          historical: historical.map((r) => ({ ...r.c, verdict: r.v })),
          faults,
        },
        null,
        2,
      )}\n`,
    );
    return broken.length > 0 || ambiguous.length > 0 || faults.length > 0 ? 1 : 0;
  }

  if (fix && moved.length > 0) {
    const byDoc = new Map<string, Array<{ c: Citation; v: Verdict }>>();
    for (const r of moved) {
      const list = byDoc.get(r.c.doc);
      if (list) list.push(r);
      else byDoc.set(r.c.doc, [r]);
    }
    for (const [doc, items] of byDoc) {
      const full = path.join(REPO, doc);
      let text = readFileSync(full, 'utf8');
      for (const r of items) {
        if (r.v.kind !== 'moved') continue;
        const replaced = r.c.raw.replace(/~\d+$/, `~${r.v.at}`);
        text = text.replace(r.c.raw, replaced);
      }
      writeFileSync(full, text);
      process.stdout.write(`fixed  ${doc}  (${items.length} hint${items.length === 1 ? '' : 's'})\n`);
    }
  }

  for (const r of broken) {
    const why = r.v.kind === 'no-file' ? 'no such file' : 'fragment not found';
    process.stdout.write(
      `BROKEN ${r.c.doc}:${r.c.docLine}\n` +
        `       ${r.c.file} · ${r.c.fragment}\n` +
        `       ${why}\n`,
    );
  }
  for (const r of ambiguous) {
    if (r.v.kind !== 'ambiguous') continue;
    process.stdout.write(
      `AMBIG  ${r.c.doc}:${r.c.docLine}\n` +
        `       "${r.c.file}" matches ${r.v.count} files — cite more of the path\n`,
    );
  }
  for (const f of faults) {
    process.stdout.write(
      `${f.label} ${f.doc}:${f.docLine}\n` + `       ${f.raw}\n` + `       ${f.why}\n`,
    );
  }
  // Printed on every run, `--fix` included. An excused citation is a citation
  // this script decided not to check, and INV-nothing-is-dropped-silently is
  // the rule that says the decision has to be visible where a person reads it.
  for (const r of historical) {
    if (r.v.kind !== 'historical') continue;
    process.stdout.write(
      `HIST   ${r.c.doc}:${r.c.docLine}  ${r.c.file}  quoted as it was — ${r.v.reason}\n`,
    );
  }
  if (!fix) {
    for (const r of moved) {
      if (r.v.kind !== 'moved') continue;
      process.stdout.write(
        `MOVED  ${r.c.doc}:${r.c.docLine}  ${r.c.file}  ~${r.c.hint} → ~${r.v.at}\n`,
      );
    }
  }

  const ok =
    rows.length - broken.length - moved.length - ambiguous.length - historical.length;
  process.stdout.write(
    `\n${rows.length} citation(s) in ${docs.length} document(s): ` +
      `${ok} ok, ${moved.length} moved, ${ambiguous.length} ambiguous, ` +
      `${historical.length} historical, ${broken.length} broken; ` +
      `${markers.length} marker(s), ${faults.length} fault(s)\n`,
  );
  if (broken.length === 0 && ambiguous.length === 0 && moved.length === 0 && faults.length === 0) {
    process.stdout.write(
      historical.length === 0
        ? 'every citation resolves.\n'
        : `every citation resolves, or says in writing that it quotes the past (${historical.length}).\n`,
    );
  }
  // A moved hint is not a failure — the fragment resolved, which is the claim.
  // `--fix` refreshes the hint; CI does not need to. A marker fault IS a
  // failure: it is the only thing standing between this exception and a
  // blanket suppressor.
  return broken.length > 0 || ambiguous.length > 0 || faults.length > 0 ? 1 : 0;
}

process.exit(main());
