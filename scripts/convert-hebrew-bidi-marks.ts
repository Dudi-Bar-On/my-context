#!/usr/bin/env node
/**
 * **Converts the Hebrew tutorials off invisible bidi control characters and
 * onto the `dir=` attributes `docs/README.he.md` already uses.**
 *
 * Owner ruling 2026-09-06 (`TASK-the-hebrew-tutorials-adopt-dir-attributes-and-the-two`):
 * two Hebrew document families kept code readable inside Hebrew prose by two
 * different mechanisms, both of which work, and the smaller family moves. The
 * three reasons, in the order that decided it: a `dir=` attribute is VISIBLE
 * IN THE SOURCE where an RLM is invisible in every editor; it SURVIVES
 * COPY-PASTE into a terminal or an issue; and it is what the larger,
 * more-read document already does.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A HAND PASS ──────────────────────────────
 *
 * 344 RLM marks and 249 non-breaking hyphens across 24 files is the volume at
 * which a hand pass introduces errors it cannot then find — and U+200F is
 * invisible, so a *missed* one is invisible too. This reports every change it
 * makes, by file and line, and is re-runnable: after a successful pass there
 * are no marks left, so a second run is a no-op that says so.
 *
 * ── THE TWO MARKS ARE NOT THE SAME KIND OF THING ──────────────────────────
 *
 * Measured over `docs/tutorials/*.he.md` before conversion:
 *
 *   - **U+2011 NON-BREAKING HYPHEN, 249 of them, every single one immediately
 *     preceded by a Hebrew letter.** This is not a bidi control at all — it is
 *     a VISIBLE hyphen glyph, the Hebrew maqaf that attaches a one-letter
 *     prefix (ל, ה, ו, מ, ש, ב, כ) to a foreign word: `ל‑config.json`. Its
 *     extent is therefore ZERO: it isolates nothing, it is a character in the
 *     text. It is replaced by an ASCII `-`, which is exactly what
 *     `docs/README.he.md` writes in the same position 398 times (`ל-Claude`,
 *     `ל-<span dir="ltr">…</span>`). 18 of the 249 join two Hebrew words
 *     (`החד‑פעמית`) and 11 join a prefix to digits (`מ‑27`); an ASCII hyphen
 *     is right in all three cases.
 *
 *   - **U+200F RIGHT-TO-LEFT MARK, 344 of them.** This one IS a bidi control,
 *     and it is a *boundary marker*: a strong RTL character placed at the edge
 *     of a Latin run so the neutrals beside that run resolve RTL instead of
 *     being swallowed into it. 331 sit immediately BEFORE a run (opening);
 *     7 sit immediately AFTER one (closing); the rest anchor leading neutral
 *     punctuation. After the runs are merged this becomes 116 wrapped runs,
 *     124 runs left bare, and 3 anchors with no LTR extent at all.
 *
 * ── HOW EACH MARK'S INTENDED EXTENT IS DETERMINED ─────────────────────────
 *
 * An RLM has no extent of its own — it is a point, and its effect runs until
 * something else ends it. A `<span dir="ltr">` has explicit bounds. Turning
 * one into the other means deciding what the author was isolating, and this
 * is where a mechanical substitution would produce text that reads correctly
 * in one renderer and wrongly in another.
 *
 * The rule used here, and the reason it is defensible: **the mark's own
 * position states one bound, and Markdown's own lexis states the other.**
 *
 *   - An OPENING RLM says "the LTR run starts here". The run's END is not a
 *     judgement call: it is where the Markdown token ends. A code span runs to
 *     its closing backtick. A bare Latin word runs to its last alphanumeric
 *     character. `scanRun` below extends across a separator (a space, a comma,
 *     a slash) only when another such token follows it, and stops dead at the
 *     first Hebrew letter, because a Hebrew letter cannot be inside an LTR
 *     run.
 *   - A CLOSING RLM says "the LTR run ends here", so the run is walked
 *     BACKWARDS to the start of the token it terminates, and then forwards by
 *     the same rule. This is what recovers `MCP ‏`create_item`` as the single
 *     run `MCP `create_item`` rather than as two islands.
 *   - An RLM before something that is not a Latin run at all — `*"…"` opening
 *     an emphasised Hebrew quotation, or a bare number — was anchoring
 *     NEUTRALS to RTL, and has no LTR extent to convert. It is deleted, and
 *     the RTL container does the job instead (see below).
 *
 * ── THE CONTAINER DIRECTION IS ALREADY THERE, AND IS NOT ADDED HERE ───────
 *
 * `docs/README.he.md` carries 150 `<div dir="rtl">` wrappers as well as its
 * 1,704 `<span dir="ltr">` runs, because GitHub renders it with no
 * enclosing direction and the first strong character would otherwise decide
 * each paragraph. The tutorials are served through `/doc.html`, and
 * `src/ui/public/doc.js` sets `dir="rtl"` and `lang="he"` on the `<article>`
 * itself for any Hebrew document. The container half of the README's
 * convention is therefore already supplied by the renderer, and adding 24
 * files' worth of `<div dir="rtl">` — which would also have to be threaded
 * around every fenced block, since the bidi algorithm reverses the runs of a
 * box-drawing table inside an RTL container — is a different change from this
 * one. **This script converts the marks and nothing else.**
 *
 * ── WHEN A RUN GETS A WRAPPER, WHICH IS NOT ALWAYS ────────────────────────
 *
 * Taken verbatim from the convention `docs/README.he.md` states in its own
 * header comment, which was established by rendering that file and reading the
 * result rather than by reasoning about the source:
 *
 *   1. A code span whose first or last character is not alphanumeric —
 *      without the wrapper `<id>` renders with its angle brackets mirrored
 *      and `--json` renders as `json--`.
 *   2. Any run of two or more Latin terms — without the wrapper each term
 *      becomes its own island, the run reads back to front, and every
 *      separator attaches to the wrong side.
 *   3. A code span whose two edge characters are both alphanumeric needs
 *      nothing, and gets nothing. `` `budgets` `` is left bare, and the RLM in
 *      front of it is simply removed.
 *
 * Rule 2 is the one that makes this a conversion rather than a substitution.
 * The old convention gave each term in `‏`error`, ‏`warning`, ‏`notice`` its
 * own mark — three islands. The README's rule is one wrapper around the whole
 * run, which is precisely the case its header comment says a per-term mark
 * "cannot hold together". Runs are therefore MERGED, and every merge is
 * reported.
 *
 * ── INSIDE A FENCE ────────────────────────────────────────────────────────
 *
 * Four non-breaking hyphens live inside fenced shell blocks, in Hebrew
 * comments on copy-pasteable commands. HTML does not render there, so no
 * wrapper is written; the hyphen is still normalised to ASCII, which is the
 * "survives copy-paste into a terminal" reason applied where it bites hardest.
 * No RLM occurs inside a fence.
 *
 *   node scripts/convert-hebrew-bidi-marks.ts           # convert, and report
 *   node scripts/convert-hebrew-bidi-marks.ts --check   # report only, exit 1 if marks remain
 *   node scripts/convert-hebrew-bidi-marks.ts --dry-run # report the changes, write nothing
 *
 * `test/core/hebrew-tutorial-bidi.test.ts` holds the result independently: zero U+200F
 * and zero U+2011 in any Hebrew tutorial, and no bidi control character
 * anywhere in the family, so the two document families cannot drift apart
 * again without a red suite.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';

/** U+200F RIGHT-TO-LEFT MARK — the invisible boundary marker being retired. */
export const RLM = '‏';
/** U+2011 NON-BREAKING HYPHEN — the visible Hebrew prefix hyphen being normalised. */
export const NBH = '‑';

/** Where the Hebrew tutorials live. Only `*.he.md` under it is ever read. */
export const TUTORIAL_DIR = path.join('docs', 'tutorials');

/** One replacement this script made, reported so a reviewer can read it. */
export interface Change {
  file: string;
  /** 1-based line of the first character of the run. */
  line: number;
  kind: 'nbh' | 'drop' | 'bare' | 'wrap';
  before: string;
  after: string;
}

/** The result of converting one file. */
export interface FileResult {
  text: string;
  changes: Change[];
}

const ALNUM = /[A-Za-z0-9]/;

function isAlnum(ch: string | undefined): boolean {
  return ch !== undefined && ALNUM.test(ch);
}

/**
 * The end (exclusive) of the Latin token starting at `i`, or `-1`.
 *
 * Two token shapes, and no others: a Markdown code span, whose end is its
 * closing backtick and is therefore not a judgement at all; and a bare Latin
 * word, which must START alphanumeric and is trimmed back to its last
 * alphanumeric character so a sentence-ending full stop is never swallowed
 * into the run.
 */
export function tokenEnd(s: string, i: number): number {
  if (s[i] === '`') {
    const close = s.indexOf('`', i + 1);
    if (close === -1) return -1;
    // A code span may be broken across ONE soft line break — several of these
    // documents wrap a long `mycontext …` invocation that way — but never
    // across a blank line, which would mean the backtick was never closed and
    // the "span" is really the rest of the document.
    const inner = s.slice(i + 1, close);
    if (inner.split('\n').length > 2 || inner.includes('\n\n')) return -1;
    return close + 1;
  }
  if (!isAlnum(s[i])) return -1;
  let end = i;
  while (end < s.length && /[A-Za-z0-9._/+:#@-]/.test(s[end])) end += 1;
  while (end > i && !isAlnum(s[end - 1])) end -= 1;
  return end > i ? end : -1;
}

/**
 * The index at which the next token of the same run must start, or `-1` when
 * what follows `i` does not separate two terms of one run.
 *
 * A separator may contain RLMs (that is where the old convention put them) and
 * may cross ONE newline, but only after a comma or a slash — a soft line break
 * mid-run is a real thing in these files (`… jit,‏\nrestored …`), while a
 * newline after a bare space is far more likely to be the next sentence.
 */
export function separatorEnd(s: string, i: number): number {
  let j = i;
  let space = false;
  let punct = false;
  let newline = false;
  for (;;) {
    const c = s[j];
    if (c === RLM) { j += 1; continue; }
    if (c === ' ' || c === '\t') { space = true; j += 1; continue; }
    if ((c === ',' || c === '/' || c === '+') && !punct && !newline) { punct = true; j += 1; continue; }
    if (c === '\n' && punct && !newline) { newline = true; j += 1; continue; }
    break;
  }
  if (!space && !punct) return -1;
  return j;
}

/** A run, as a half-open source range, plus how many tokens it holds. */
interface Run { start: number; end: number; tokens: number; }

/**
 * The full LTR run that starts at `start`, by the rule documented at the top:
 * token, then separator-and-token for as long as both hold.
 */
export function scanRun(s: string, start: number): Run | null {
  let end = tokenEnd(s, start);
  if (end === -1) return null;
  let tokens = 1;
  for (;;) {
    const afterSep = separatorEnd(s, end);
    if (afterSep === -1) break;
    const next = tokenEnd(s, afterSep);
    if (next === -1) break;
    end = next;
    tokens += 1;
  }
  return { start, end, tokens };
}

/**
 * Walk backwards from a CLOSING RLM at `i` to the start of the token it
 * terminates, skipping back over a trailing comma or slash first (`pinned,‏`).
 * Returns `-1` when there is no Latin token behind it.
 */
export function runStartBefore(s: string, i: number): number {
  let j = i - 1;
  while (j >= 0 && (s[j] === ' ' || s[j] === '\t' || s[j] === ',' || s[j] === '/')) j -= 1;
  if (j < 0) return -1;
  if (s[j] === '`') {
    const open = s.lastIndexOf('`', j - 1);
    return open === -1 ? -1 : open;
  }
  if (!isAlnum(s[j])) return -1;
  let start = j;
  while (start > 0 && /[A-Za-z0-9._/+:#@-]/.test(s[start - 1]) && isAlnum(s[start - 1])) start -= 1;
  // Extend across internal punctuation (`v1.0.2`, `first-fit`) but never past
  // a character that is not alphanumeric on BOTH sides, which is what stops
  // the walk at the `-` of a Hebrew prefix such as `ה-MCP`.
  while (start > 1 && /[._/+:#@-]/.test(s[start - 1]) && isAlnum(s[start - 2])) {
    start -= 1;
    while (start > 0 && isAlnum(s[start - 1])) start -= 1;
  }
  return start;
}

/**
 * Whether a run needs `<span dir="ltr">`, by `docs/README.he.md`'s own rule.
 * `text` is the run with its RLMs already stripped.
 */
export function needsWrapper(text: string, tokens: number): boolean {
  if (tokens >= 2) return true;
  if (text.startsWith('`') && text.endsWith('`') && text.length > 2) {
    const inner = text.slice(1, -1);
    return !isAlnum(inner[0]) || !isAlnum(inner[inner.length - 1]);
  }
  return false;
}

/** The 1-based line number of offset `i` in `s`. */
function lineOf(s: string, i: number): number {
  let n = 1;
  for (let k = 0; k < i; k += 1) if (s[k] === '\n') n += 1;
  return n;
}

/** The source line holding offset `i`, for the report. */
function lineText(s: string, i: number): string {
  const from = s.lastIndexOf('\n', i - 1) + 1;
  const to = s.indexOf('\n', i);
  return s.slice(from, to === -1 ? s.length : to);
}

/** Line indices (0-based) that are inside a fenced code block. */
function fencedLines(text: string): Set<number> {
  const out = new Set<number>();
  let open: string | null = null;
  text.split('\n').forEach((line, index) => {
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (open === null) {
      if (m !== null) { open = m[1][0].repeat(m[1].length); out.add(index); }
      return;
    }
    out.add(index);
    if (m !== null && m[1][0] === open[0] && m[1].length >= open.length && m[2].trim() === '') open = null;
  });
  return out;
}

/**
 * Convert one document. Pure: takes text, returns text and the report.
 *
 * Two passes, in this order and for a reason. The hyphen pass first, because
 * a U+2011 sitting between a Hebrew prefix and a code span would otherwise
 * look like part of the run to the walk-back in the RLM pass; once it is an
 * ASCII `-` preceded by a Hebrew letter, `runStartBefore` stops on it
 * correctly.
 */
export function convert(file: string, text: string): FileResult {
  const changes: Change[] = [];
  const fenced = fencedLines(text);

  // ── Pass 1: the visible Hebrew prefix hyphen ────────────────────────────
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== NBH) { out += text[i]; continue; }
    changes.push({
      file, line: lineOf(text, i), kind: 'nbh',
      before: `${text[i - 1] ?? ''}‑${text[i + 1] ?? ''}`,
      after: `${text[i - 1] ?? ''}-${text[i + 1] ?? ''}`,
    });
    out += '-';
  }
  text = out;

  // ── Pass 2: the RLM boundary markers ────────────────────────────────────
  // Runs are collected first, over the whole document, so two RLMs bounding
  // one run (`MCP‏ `x`, ‏`y``) collapse into a single wrapper instead of
  // producing nested ones.
  const runs: Run[] = [];
  const drops: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== RLM) continue;
    if (runs.some((r) => i > r.start && i < r.end)) continue; // already absorbed
    const forward = scanRun(text, i + 1);
    if (forward !== null) {
      // An OPENING mark: the run starts immediately after it, and the mark
      // ITSELF is inside the replaced range — otherwise the wrapper is written
      // correctly and the invisible character it replaces survives beside it,
      // which is the one outcome this whole exercise exists to prevent.
      runs.push({ ...forward, start: i });
      continue;
    }
    const back = runStartBefore(text, i);
    if (back !== -1) {
      const whole = scanRun(text, back);
      if (whole !== null && whole.end > i) { runs.push(whole); continue; }
    }
    // Neither: the mark was anchoring neutrals, and the RTL container does
    // that job. Nothing to wrap.
    drops.push(i);
  }

  // Merge runs that touch or overlap, so one wrapper covers one run.
  runs.sort((a, b) => a.start - b.start);
  const merged: Run[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last !== undefined && r.start <= last.end) {
      if (r.end > last.end) { last.end = r.end; last.tokens += r.tokens; }
      continue;
    }
    merged.push({ ...r });
  }

  // Rebuild, right to left, so earlier offsets stay valid.
  const edits: Array<{ start: number; end: number; text: string; change: Change }> = [];
  for (const r of merged) {
    const raw = text.slice(r.start, r.end);
    const clean = raw.replaceAll(RLM, '');
    const line = lineOf(text, r.start);
    const inFence = fenced.has(line - 1);
    const wrap = !inFence && needsWrapper(clean, r.tokens);
    const replacement = wrap ? `<span dir="ltr">${clean}</span>` : clean;
    edits.push({
      start: r.start, end: r.end, text: replacement,
      change: {
        file, line, kind: wrap ? 'wrap' : 'bare',
        before: lineText(text, r.start).replaceAll(RLM, '‹RLM›'),
        after: '',
      },
    });
  }
  for (const i of drops) {
    edits.push({
      start: i, end: i + 1, text: '',
      change: {
        file, line: lineOf(text, i), kind: 'drop',
        before: lineText(text, i).replaceAll(RLM, '‹RLM›'),
        after: '',
      },
    });
  }
  edits.sort((a, b) => b.start - a.start);
  let result = text;
  for (const e of edits) result = result.slice(0, e.start) + e.text + result.slice(e.end);

  // The "after" line is read off the FINISHED text, so the report shows what
  // the file actually says rather than what one edit intended.
  for (const e of edits) {
    const at = result.indexOf(e.text === '' ? '' : e.text);
    e.change.after = at === -1 ? '' : lineText(result, Math.max(at, 0));
  }
  // Simpler and honest: recompute each reported line from the finished text by
  // line number, since edits never add or remove lines.
  const resultLines = result.split('\n');
  for (const e of edits) e.change.after = resultLines[e.change.line - 1] ?? '';

  changes.push(...edits.map((e) => e.change).sort((a, b) => a.line - b.line));
  return { text: result, changes };
}

/** Every Hebrew tutorial, by repo-relative path, sorted. */
export function hebrewTutorials(repoRoot: string): string[] {
  const dir = path.join(repoRoot, TUTORIAL_DIR);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.he.md'))
    .sort()
    .map((f) => path.join(TUTORIAL_DIR, f));
}

/** Counts of the two marks still present, per file. */
export function surveyMarks(repoRoot: string): Array<{ file: string; rlm: number; nbh: number }> {
  return hebrewTutorials(repoRoot).map((file) => {
    const text = readFileSync(path.join(repoRoot, file), 'utf8');
    return {
      file,
      rlm: (text.match(new RegExp(RLM, 'g')) ?? []).length,
      nbh: (text.match(new RegExp(NBH, 'g')) ?? []).length,
    };
  });
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const repoRoot = path.join(import.meta.dirname, '..');
  const check = process.argv.includes('--check');
  const dryRun = process.argv.includes('--dry-run');

  if (check) {
    const survey = surveyMarks(repoRoot);
    const dirty = survey.filter((s) => s.rlm > 0 || s.nbh > 0);
    const rlm = survey.reduce((a, s) => a + s.rlm, 0);
    const nbh = survey.reduce((a, s) => a + s.nbh, 0);
    console.log(`${survey.length} Hebrew tutorials: ${rlm} RLM (U+200F), ${nbh} non-breaking hyphens (U+2011)`);
    for (const s of dirty) console.log(`  ${s.file}: rlm=${s.rlm} nbh=${s.nbh}`);
    process.exit(dirty.length === 0 ? 0 : 1);
  }

  const files = hebrewTutorials(repoRoot);
  let totals = { nbh: 0, drop: 0, bare: 0, wrap: 0 };
  let touched = 0;
  for (const file of files) {
    const full = path.join(repoRoot, file);
    const before = readFileSync(full, 'utf8');
    const { text, changes } = convert(file, before);
    if (changes.length === 0) continue;
    touched += 1;
    for (const c of changes) totals[c.kind] += 1;
    console.log(`\n── ${file} — ${changes.length} changes`);
    const byLine = new Map<number, Change[]>();
    for (const c of changes) byLine.set(c.line, [...(byLine.get(c.line) ?? []), c]);
    for (const [line, list] of [...byLine].sort((a, b) => a[0] - b[0])) {
      const kinds = list.map((c) => c.kind).join(',');
      if (list.every((c) => c.kind === 'nbh')) {
        console.log(`  ${line} [${kinds}] ${list.map((c) => `${c.before} → ${c.after}`).join('  ')}`);
        continue;
      }
      console.log(`  ${line} [${kinds}]`);
      console.log(`    - ${list[0].before}`);
      console.log(`    + ${list[0].after}`);
    }
    if (!dryRun) writeFileSync(full, text, 'utf8');
  }
  const sum = totals.nbh + totals.drop + totals.bare + totals.wrap;
  console.log(`\n${dryRun ? 'would change' : 'changed'} ${touched}/${files.length} files, ${sum} marks: `
    + `${totals.nbh} hyphens → "-", ${totals.wrap} runs wrapped in <span dir="ltr">, `
    + `${totals.bare} runs left bare (alphanumeric edges), ${totals.drop} anchors dropped (no LTR run).`);
  if (sum === 0) console.log('nothing to do — already converted.');
}
