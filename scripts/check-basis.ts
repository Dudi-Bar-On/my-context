#!/usr/bin/env node
/**
 * **A test says what it rests on, so that reversing a ruling shows you which
 * tests were built on it.**
 *
 *     npm run check:basis
 *
 * `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` is the
 * owner ruling this enforces, and commit `cdc9fd8` is the measurement behind
 * it. `budget/16` reversed one admission rule and reddened 26 fixtures across
 * ten files. **Not one was a logic failure** — every one asserted an absence
 * the reversed rule had made true — and **zero named the rule they rested on.**
 * They encoded it instead: a golden string, a bare `pinned: 1500`, an item
 * titled "Only an index line", a helper comment reading "one pinned item and
 * one index-only item" with no id in it. Nothing could find them because there
 * was nothing to search for, and it cost an hour of reading to establish that
 * none of the 26 was a real failure.
 *
 * ── WHY `none` IS A LEGAL ANSWER, WHICH IS THE WHOLE DESIGN ─────────────────
 *
 * Of those same 26, exactly ONE cited an item and it cited the WRONG one — a
 * rule still in force, while the assertion above it rested on the rule being
 * reversed. A reader who checked that citation concluded the test was covered.
 * **It was the only one that looked responsible and the most dangerous in the
 * set.** So this gate requires the THOUGHT and never a link: `none` passes,
 * with a reason, and a bare `none` does not. If naming an item were mandatory a
 * writer under pressure would name the nearest plausible one, and that is
 * measurably worse than silence.
 *
 * ── SCOPED TO FILES THAT DO NOT PREDATE THE RULE ────────────────────────────
 *
 * 490 test files existed when this landed and six declared a basis. Gating the
 * other 484 would produce exactly the fabricated declarations the rule exists
 * to prevent — an author asked today what a fixture written months ago rested
 * on will guess, and a guess that resolves is the dangerous shape above wearing
 * a checkmark. So `scripts/basis-undeclared.txt` names them and they are
 * exempt, and the exemption is only ever for SILENCE.
 *
 * **Nine of the 484 were retrofitted anyway, and only those nine.** They are the
 * files `cdc9fd8` had to repair, and that commit's own message records what they
 * rest on — so declaring them is reading, not guessing. They are also the
 * ruling's stated acceptance test: *if the mechanism cannot express those 26, it
 * does not work.* It expresses them, and the baseline is 475.
 *
 * **The baseline may only shrink, and that is enforced two ways.** Adding a
 * line to it is a visible act in a reviewed diff, and
 * `test/scripts/basis-gate.test.ts` pins its length as a CEILING — a new file
 * smuggled into the exemption list fails `npm test` as well as review. Removing
 * a line is what happens when somebody declares an old file's basis, and
 * nothing here ever asks them to.
 *
 * ── WHAT GATES AND WHAT ONLY REPORTS, AND WHY THE LINES ARE THERE ───────────
 *
 * **MISSING gates** for a file outside the baseline. It is the rule itself, it
 * is binary, and the author is the one person who knows the answer.
 *
 * **MALFORMED gates**, baseline or not. A file that carries a declaration has
 * stopped predating the rule; the exemption is for silence, not for a broken
 * claim.
 *
 * **DANGLING gates.** A declared id that answers to no item is a pointer into
 * nothing, cheap to repair and with one honest reading — the same line
 * `scripts/check-handover.ts` draws for the same reason.
 *
 * **RETIRED only reports.** A test resting on a superseded ruling is often
 * exactly right as history, and `scripts/check-cited-items.ts` refuses to gate
 * the same shape one layer over, after an owner ruling that a gate forcing
 * thirty-one edits would delete history to go green. The finding names the
 * successor so the reader does not have to look it up.
 *
 * **UNDECLARED (in the baseline) only reports**, and the count is printed on
 * every run so the gap is visible without anybody being forced to invent a
 * link.
 *
 * ── WHAT IT REUSES, AND THE ONE PLACE IT DELIBERATELY DIFFERS ───────────────
 *
 * `ITEM_ID`, `readCorpus` and `resolveId` come from `check-handover.ts`, and
 * that resolution is load-bearing rather than decorative: shortened and
 * hyphen-broken ids are how this corpus actually writes them, and an
 * exact-match scan misses 9 of `check-cited-items.ts`'s 56 sites.
 *
 * **`resolveId`'s `skip` is treated as a FINDING here, and that is the
 * divergence.** `skip` exists so that `UI-side`, `MCP-only` and `NUL-byte` in
 * running prose are not reported as four broken pointers — a checker wrong four
 * times on its first run is a checker switched off on its second. **A
 * declaration is not prose.** Every token after `@basis` is a deliberate claim
 * about the corpus, so a token shaped like an id that answers to nothing is
 * DANGLING here even where the same string would be ignored in a comment.
 *
 * ── THE LANE SPELLING IS REFUSED, AND THE REFUSAL NAMES THE ITEM ────────────
 *
 * Measured in the tree: `test/` and `e2e/` carry 150+ `plan:<plan> seq:<n>` and
 * backticked `<plan>/<n>` lane references, and every one of the ten repair
 * comments `cdc9fd8` wrote names `plan:budget seq:16` rather than an item id.
 * That is the corpus's real habit, so the gate must expect it. It is still
 * refused — the rule says item ids, an id is what the corpus answers to where a
 * lane key is a dispatch coordinate, and one accepted vocabulary is what makes
 * the inverse report a single answer. **But it is refused BY NAME**: the
 * message resolves the lane through `Corpus.lanes` and prints the item id to
 * write instead, so the writer copies a real one rather than inventing one.
 *
 * ── THE INVERSE DIRECTION IS DERIVED, NEVER STORED ──────────────────────────
 *
 * `--items` inverts the declarations into "which tests name this item", which
 * is the other half of the ruling (`plan:basis seq:1`) with no corpus write at
 * all. It also prints the items whose `scope` names a test path, so the two
 * spellings of the same claim can be compared. Measured, and the reason the
 * inverse is derived rather than written into `scope`: `matchesScope`
 * (`src/core/select.ts`) makes an EMPTY scope unrestricted under every
 * category's `global` policy, so the first covering-test path added to any of
 * the 814 unscoped items of this corpus narrows it from "injected on every
 * path" to "injected on that one test file".
 *
 * ── WHAT IT CANNOT SEE, STATED SO THE NUMBER IS NOT READ WIDER THAN IT IS ───
 *
 * **This catches "this test VERIFIES item X", never "this test ASSUMES item
 * X".** The rule says so itself, and the second is what actually caused the
 * damage: nobody sat down thinking "I am encoding the admission rule". That
 * half is only reachable at the moment somebody REVERSES a ruling.
 *
 * **Two of `cdc9fd8`'s affected fixtures are out of reach by construction.**
 * `README.md` and `docs/README.he.md` carry golden SessionStart blocks that the
 * commit had to regenerate; they are Markdown, they carry no comment syntax
 * this can read, and no `@basis` line can live in them.
 *
 * **Helper modules are reported, never gated.** The gated set is `*.test.ts`
 * under `test/` and `*.spec.ts` under `e2e/` — the rule's own subject. Three
 * e2e helpers already declare `@basis none` with a reason, so the convention
 * plainly reaches them; a helper that grows an assertion is a blind spot, named
 * here rather than closed by widening the gate over 51 more files nobody was
 * asked about.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadLayer, type LoadError } from '../src/core/rebuild.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';
import { RETIRED_STATUSES } from '../src/core/select.ts';
import { ITEM_ID, readCorpus, resolveId, type Corpus } from './check-handover.ts';
import { successorChain } from './check-cited-items.ts';
import type { Item } from '../src/core/types.ts';

const REPO = path.resolve(import.meta.dirname, '..');

/**
 * The two trees, and the two suffixes, that the rule's own `scope` names. A
 * file that is not a test carries no assertion the rule is about — see the
 * helper blind spot in this file's header.
 */
export const TEST_ROOTS: Array<{ root: string; suffix: string }> = [
  { root: 'test', suffix: '.test.ts' },
  { root: 'e2e', suffix: '.spec.ts' },
];

/** The committed list of test files that predate the rule. */
export const BASELINE_FILE = 'scripts/basis-undeclared.txt';

/**
 * The declaration marker, anchored to the START of a comment line.
 *
 * Anchored, and read only inside the file's header (`headerLines` below), for
 * one reason: `test/scripts/basis-gate.test.ts` has to plant malformed
 * declarations to prove this refuses them, and a scanner that read whole files
 * would find its own fixtures and report the test that verifies it.
 */
export const BASIS_MARKER =
  /^[ \t]*(?:\/\/+|\/\*+|\*+(?!\/))[ \t]*@basis\b[ \t]*(.*?)[ \t]*(?:\*+\/)?[ \t]*$/;

/** A comment or blank line: the two things a file header is made of. */
const HEADER_LINE = /^[ \t]*(?:\/\/|\/\*|\*|$)/;

/** The payload of any comment line, marker stripped, for reason continuation. */
const COMMENT_PAYLOAD = /^[ \t]*(?:\/\/+|\/\*+|\*+(?!\/))[ \t]?(.*?)[ \t]*(?:\*+\/)?[ \t]*$/;

/**
 * A WHOLE item id, as a declaration must write it. `ITEM_ID` is a SCANNER — it
 * finds ids inside prose — and reusing it unanchored here would read `see
 * RULE-x for why` as a declaration of `RULE-x`. Its source is reused rather
 * than restated so the two grammars cannot drift apart.
 */
export const WHOLE_ITEM_ID = new RegExp(`^(?:${ITEM_ID.source.replace(/\\b/g, '')})$`);

/**
 * The lane spellings this corpus actually writes, so the refusal can name the
 * item instead of only refusing. `plan:budget seq:16` is the form every one of
 * `cdc9fd8`'s repair comments used; `` `budget/16` `` is the form the handover
 * uses 100 times out of 100.
 */
export const LANE_SPELLING =
  /^(?:plan:[ \t]*([a-z][a-z0-9-]*)[ \t]+seq:[ \t]*(\d+[a-z]?)|`?([a-z][a-z0-9-]*)\/(\d+[a-z]?)`?)$/;

/**
 * The floor a stated reason has to clear, and it is deliberately the lowest one
 * that does any work.
 *
 * `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` writes its
 * own example as `@basis none - pure parser mechanics`: three words, 21
 * characters. The threshold is set so that example passes EXACTLY and nothing
 * shorter does, which refuses `n/a`, `none`, `todo` and `-` without this gate
 * ever adjudicating whether a reason is a GOOD one. Judging the prose is not
 * this script's business and must not become it.
 */
export const REASON_MIN_WORDS = 3;
export const REASON_MIN_CHARS = 12;

export type DeclKind = 'items' | 'none' | 'malformed' | 'missing';

/** One token written after `@basis`, and what the corpus says about it. */
export interface Declared {
  /** Exactly as written, which may be shortened or hyphen-broken. */
  raw: string;
  /** The full id it resolved to, or `null`. */
  id: string | null;
  /** Why it did not resolve, when it did not. */
  why: string | null;
}

export interface Declaration {
  kind: DeclKind;
  /** 1-based line of the marker, or 0 when there is no declaration at all. */
  line: number;
  /** The declaration as written, joined across continuation lines. */
  raw: string;
  /** `items` only. */
  ids: Declared[];
  /** `none` only. */
  reason: string;
  /** `malformed` only: what is wrong, in the words the writer needs. */
  why: string;
}

const NO_DECLARATION: Declaration =
  { kind: 'missing', line: 0, raw: '', ids: [], reason: '', why: '' };

/**
 * The run of blank and comment lines at the top of the file, which is where a
 * declaration lives and the only place this looks. It ends at the first line of
 * code, so a planted string in a template literal below is out of reach by
 * construction rather than by a heuristic.
 */
export function headerLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!HEADER_LINE.test(line)) break;
    out.push(line);
  }
  return out;
}

function tokensOf(payload: string): string[] {
  return payload.split(/[,\s]+/).filter((t) => t !== '');
}

/**
 * Parse the declaration out of a file's header, or say there is none.
 *
 * Exported and pure so `test/scripts/basis-gate.test.ts` can plant text
 * directly rather than writing files — the same move `handover-check.test.ts`
 * makes against `scan`, and the reason the marker can stay anchored.
 *
 * `corpus` is nullable so the grammar can be tested without a corpus; with
 * `null` every id parses but none resolves.
 */
export function parseBasis(text: string, corpus: Corpus | null): Declaration {
  const lines = headerLines(text);
  const marks: number[] = [];
  for (let i = 0; i < lines.length; i++) if (BASIS_MARKER.test(lines[i]!)) marks.push(i);
  if (marks.length === 0) return NO_DECLARATION;
  const at = marks[0]!;
  const line = at + 1;
  if (marks.length > 1) {
    return {
      ...NO_DECLARATION, kind: 'malformed', line, raw: lines[at]!.trim(),
      why: `${marks.length} @basis lines in one header — write ONE declaration listing every ` +
        'id it rests on, or the two readings of this file disagree',
    };
  }
  const first = BASIS_MARKER.exec(lines[at]!)![1]!.trim();
  if (first === '') {
    return {
      ...NO_DECLARATION, kind: 'malformed', line, raw: lines[at]!.trim(),
      why: '@basis with nothing after it — name the item ids this test rests on, or write ' +
        '`none - <why it rests on no ruling>`',
    };
  }

  // `none`, and the reason, which may wrap onto the following comment lines the
  // way a sentence does. A blank comment line ends it, because that is the
  // paragraph boundary every docblock in this tree is written with.
  const none = /^none\b[ \t]*(?:[-–—:][ \t]*(.*))?$/i.exec(first);
  if (none !== null) {
    const parts: string[] = [];
    const head = (none[1] ?? '').trim();
    if (head !== '') parts.push(head);
    for (let i = at + 1; i < lines.length; i++) {
      const m = COMMENT_PAYLOAD.exec(lines[i]!);
      const payload = (m?.[1] ?? '').trim();
      if (payload === '' || payload.startsWith('@')) break;
      parts.push(payload);
    }
    const reason = parts.join(' ').trim();
    const words = reason.split(/\s+/).filter((w) => w !== '').length;
    if (reason === '') {
      return {
        ...NO_DECLARATION, kind: 'malformed', line, raw: `@basis ${first}`,
        why: 'a bare `none` does not pass — the reason is the whole design. Write ' +
          '`none - <why this test rests on no ruling>`',
      };
    }
    if (words < REASON_MIN_WORDS || reason.length < REASON_MIN_CHARS) {
      return {
        ...NO_DECLARATION, kind: 'malformed', line, raw: `@basis none - ${reason}`,
        why: `the reason is ${words} word(s), ${reason.length} character(s) — at least ` +
          `${REASON_MIN_WORDS} words and ${REASON_MIN_CHARS} characters, which is the length ` +
          "of the rule's own example, `none - pure parser mechanics`",
      };
    }
    return { kind: 'none', line, raw: `@basis none - ${reason}`, ids: [], reason, why: '' };
  }

  // Ids, continuing onto the next comment line while the line ends in a comma.
  const payloads = [first];
  for (let i = at + 1; i < lines.length && payloads[payloads.length - 1]!.endsWith(','); i++) {
    const m = COMMENT_PAYLOAD.exec(lines[i]!);
    const payload = (m?.[1] ?? '').trim();
    if (payload === '') break;
    payloads.push(payload);
  }
  const joined = payloads.join(' ');
  const raw = `@basis ${joined}`;
  const tokens = tokensOf(joined);
  const bad = tokens.filter((t) => !WHOLE_ITEM_ID.test(t));
  if (bad.length > 0) {
    const lane = LANE_SPELLING.exec(joined.trim());
    if (lane !== null) {
      const key = `${lane[1] ?? lane[3]!}/${lane[2] ?? lane[4]!}`;
      const named = corpus === null
        ? []
        : [...(corpus.lanes.get(key) ?? []), ...(corpus.retiredLanes.get(key) ?? [])];
      const says = named.length === 0
        ? 'and no task answers to that lane either'
        : `which is ${named.map((i) => i.id).join(', ')} — write that`;
      return {
        ...NO_DECLARATION, kind: 'malformed', line, raw,
        why: `\`${key}\` is a lane, not an item id, ${says}. A lane is a dispatch coordinate; ` +
          'an id is what the corpus answers to',
      };
    }
    return {
      ...NO_DECLARATION, kind: 'malformed', line, raw,
      why: `${bad.map((b) => `"${b}"`).join(', ')} is not an item id. Write one or more ids ` +
        'separated by commas, or `none - <reason>`',
    };
  }
  const ids: Declared[] = tokens.map((t) => {
    if (corpus === null) return { raw: t, id: null, why: null };
    const r = resolveId(corpus, t);
    // `skip` is a finding here and only here — see this file's header. In prose
    // it protects `UI-side` from being called a broken pointer; in a
    // declaration every token is a deliberate claim about the corpus.
    if (r.id === null && r.why === null) return { raw: t, id: null, why: 'no item answers to it' };
    return { raw: t, id: r.id, why: r.why };
  });
  return { kind: 'items', line, raw, ids, reason: '', why: '' };
}

export type Tier = 'MISSING' | 'MALFORMED' | 'DANGLING' | 'RETIRED';

export interface Finding {
  tier: Tier;
  file: string;
  line: number;
  /** The declaration as written, when there was one. */
  raw: string;
  /** What is wrong, in the words the writer needs. */
  why: string;
  /** `RETIRED` only: `superseded_by` followed to the end. */
  chain: Array<{ id: string; status: string; title: string }>;
  /** Whether this finding sets the exit code. */
  gates: boolean;
}

export interface Report {
  /** Every gated test file walked. */
  filesWalked: number;
  declaredItems: number;
  declaredNone: number;
  /** Files with no declaration that the baseline exempts. */
  undeclaredBaselined: string[];
  /** Files with no declaration that the baseline does not exempt. */
  undeclaredNew: string[];
  /** Baseline entries naming a file that no longer exists. */
  baselineDead: string[];
  /** Baseline entries whose file now declares a basis, so the entry is spent. */
  baselineSpent: string[];
  findings: Finding[];
  /** item id → the test files that declare it. The inverse direction. */
  covers: Map<string, string[]>;
  /** Helper modules (not gated) that declare a basis anyway. */
  helpersDeclaring: string[];
}

export function walkTests(dir: string, suffix: string, out: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = path.join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walkTests(full, suffix, out);
    else if (entry.endsWith(suffix)) out.push(full);
  }
  return out;
}

const rel = (repo: string, full: string): string =>
  path.relative(repo, full).split(path.sep).join('/');

/** Every gated test file, repo-relative and POSIX, sorted. */
export function testFiles(repo: string): string[] {
  const out: string[] = [];
  for (const { root, suffix } of TEST_ROOTS) walkTests(path.join(repo, root), suffix, out);
  return out.map((f) => rel(repo, f)).sort();
}

/** Every `.ts` under the two roots that is NOT a gated test file. */
export function helperFiles(repo: string): string[] {
  const gated = new Set(testFiles(repo));
  const out: string[] = [];
  for (const { root } of TEST_ROOTS) walkTests(path.join(repo, root), '.ts', out);
  return out.map((f) => rel(repo, f)).filter((f) => !gated.has(f)).sort();
}

/**
 * The baseline, read as a list of repo-relative POSIX paths. `#` lines and
 * blank lines are the file's own header, which explains what it is to the next
 * person who opens it.
 */
export function parseBaseline(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
}

export function build(
  repo: string, files: string[], baseline: string[], corpus: Corpus,
): Report {
  const exempt = new Set(baseline);
  const byId = corpus.byId;
  const findings: Finding[] = [];
  const covers = new Map<string, string[]>();
  const report: Report = {
    filesWalked: files.length,
    declaredItems: 0,
    declaredNone: 0,
    undeclaredBaselined: [],
    undeclaredNew: [],
    baselineDead: [],
    baselineSpent: [],
    findings,
    covers,
    helpersDeclaring: [],
  };
  const onDisk = new Set(files);
  const declaredFiles = new Set<string>();

  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(path.join(repo, ...file.split('/')), 'utf8');
    } catch {
      continue;
    }
    const decl = parseBasis(text, corpus);
    if (decl.kind === 'missing') {
      if (exempt.has(file)) report.undeclaredBaselined.push(file);
      else {
        report.undeclaredNew.push(file);
        findings.push({
          tier: 'MISSING', file, line: 1, raw: '', gates: true, chain: [],
          why: 'no `// @basis` in the file header. Name the item ids this test rests on, or ' +
            'write `// @basis none - <why it rests on no ruling>` — `none` is a legal answer',
        });
      }
      continue;
    }
    declaredFiles.add(file);
    if (decl.kind === 'malformed') {
      findings.push({
        tier: 'MALFORMED', file, line: decl.line, raw: decl.raw, why: decl.why,
        gates: true, chain: [],
      });
      continue;
    }
    if (decl.kind === 'none') {
      report.declaredNone++;
      continue;
    }
    report.declaredItems++;
    for (const d of decl.ids) {
      if (d.id === null) {
        findings.push({
          tier: 'DANGLING', file, line: decl.line, raw: decl.raw, gates: true, chain: [],
          why: `\`${d.raw}\` — ${d.why ?? 'no item answers to it'}`,
        });
        continue;
      }
      const bucket = covers.get(d.id);
      if (bucket === undefined) covers.set(d.id, [file]);
      else if (!bucket.includes(file)) bucket.push(file);
      const item = byId.get(d.id)!;
      if (!RETIRED_STATUSES.has(item.status)) continue;
      findings.push({
        tier: 'RETIRED', file, line: decl.line, raw: decl.raw, gates: false,
        chain: successorChain(item, byId).map((c) => ({
          id: c.id, status: c.status, title: c.title,
        })),
        why: `\`${d.id}\` is ${item.status} — ${item.title}`,
      });
    }
  }

  for (const entry of baseline) {
    if (!onDisk.has(entry)) report.baselineDead.push(entry);
    else if (declaredFiles.has(entry)) report.baselineSpent.push(entry);
  }
  for (const file of helperFiles(repo)) {
    let text: string;
    try {
      text = readFileSync(path.join(repo, ...file.split('/')), 'utf8');
    } catch {
      continue;
    }
    if (parseBasis(text, corpus).kind !== 'missing') report.helpersDeclaring.push(file);
  }
  return report;
}

export function render(report: Report): string {
  const out: string[] = [];
  for (const f of report.findings) {
    out.push(`${f.tier} ${f.file}:${f.line}`);
    out.push(`        ${f.why}`);
    if (f.raw !== '') out.push(`        wrote: ${f.raw.slice(0, 140)}`);
    if (f.tier === 'RETIRED') {
      if (f.chain.length === 0) {
        out.push('        NO SUCCESSOR RECORDED — the corpus holds no `superseded_by` edge from');
        out.push('        it, so a reader who follows this declaration has nowhere to go next.');
      } else {
        let indent = '        superseded by ';
        for (const c of f.chain) {
          out.push(`${indent}${c.id}${RETIRED_STATUSES.has(c.status) ? `  [${c.status} TOO]` : ''}`);
          indent = '        ↳ then by      ';
        }
      }
      out.push('        REPORTED, NEVER GATED. A test resting on a superseded ruling is often');
      out.push('        correct as history. The repair is to say so where the reader is.');
    }
    out.push('');
  }
  return out.join('\n');
}

/** The inverse direction: which tests name each item, and which items name tests. */
export function renderItems(report: Report, items: Item[]): string {
  const out: string[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  out.push(`${report.covers.size} item(s) are named by a test's @basis declaration:`);
  for (const id of [...report.covers.keys()].sort()) {
    const item = byId.get(id);
    out.push(`  ${id}${item === undefined ? '' : `  [${item.type}/${item.status}]`}`);
    for (const f of report.covers.get(id)!.slice().sort()) out.push(`        ${f}`);
  }
  const isTestPath = (g: string): boolean => g.startsWith('test/') || g.startsWith('e2e/');
  const scoped = items
    .filter((i) => i.scope.some(isTestPath))
    .sort((a, b) => a.id.localeCompare(b.id));
  out.push('');
  out.push(
    `${scoped.length} item(s) name a test path in \`scope\` instead, where nothing can say ` +
      'which of the two things it means — governs, or is checked by:',
  );
  for (const i of scoped) {
    const paths = i.scope.filter(isTestPath);
    const globs = paths.filter((g) => g.includes('*'));
    out.push(
      `  ${i.id}  [${i.type}]  ${paths.join(', ')}` +
        (globs.length === 0 ? '' : `   <- ${globs.length} glob(s): file-level coverage invisible`),
    );
  }
  return out.join('\n');
}

export function summary(report: Report, showUndeclared: boolean): string {
  const out: string[] = [];
  const declared = report.declaredItems + report.declaredNone;
  out.push(
    `${declared} of ${report.filesWalked} test file(s) declare a basis: ` +
      `${report.declaredItems} name item(s), ${report.declaredNone} say \`none\` with a reason ` +
      `· ${report.covers.size} distinct item(s) are named`,
  );
  out.push(
    `${report.undeclaredBaselined.length} predate the rule and are exempt via ${BASELINE_FILE}; ` +
      `${report.undeclaredNew.length} do not and are gated.`,
  );
  const gating = report.findings.filter((f) => f.gates);
  if (gating.length === 0) {
    out.push('no test file outside the baseline is missing a basis or malformed.');
  } else {
    const byTier = (t: Tier): number => gating.filter((f) => f.tier === t).length;
    out.push(
      `${gating.length} finding(s) set the exit code: ${byTier('MISSING')} MISSING, ` +
        `${byTier('MALFORMED')} MALFORMED, ${byTier('DANGLING')} DANGLING.`,
    );
  }
  const retired = report.findings.filter((f) => f.tier === 'RETIRED');
  if (retired.length > 0) {
    out.push(
      `${retired.length} declaration(s) name a RETIRED item. Reported, never gated — the ` +
        'successors are printed above.',
    );
  }
  if (report.baselineDead.length > 0 || report.baselineSpent.length > 0) {
    out.push(
      `${BASELINE_FILE}: ${report.baselineDead.length} entr(ies) name a file that no longer ` +
        `exists and ${report.baselineSpent.length} name a file that now declares a basis. Both ` +
        'are spent lines and deleting them is the whole repair.',
    );
  }
  if (report.helpersDeclaring.length > 0) {
    out.push(
      `${report.helpersDeclaring.length} helper module(s) under test/ and e2e/ declare a basis ` +
        `although nothing gates them: ${report.helpersDeclaring.join(', ')}.`,
    );
  }
  if (!showUndeclared && report.undeclaredBaselined.length > 0) {
    out.push('');
    out.push(
      `--undeclared lists the ${report.undeclaredBaselined.length} exempt file(s). Nobody is ` +
        'asked to fill them in: an author asked today what a fixture written months ago rested ' +
        'on will guess, and a guess that resolves is worse than silence — see ' +
        'RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none.',
    );
  }
  out.push('');
  out.push(
    'BLIND SPOT, stated so this number is not read wider than it is: a declaration says what a ' +
      'test VERIFIES, never what it ASSUMES — and it was the assumed half that reddened 26 ' +
      'fixtures in cdc9fd8. Two of those fixtures live in README.md and docs/README.he.md, ' +
      'which carry no comment syntax and can never declare anything.',
  );
  return out.join('\n');
}

/**
 * The tree to walk, which is this repository unless `--root` says otherwise.
 *
 * **`--root` exists for exactly one reason and it is not configurability.** A
 * checker is not verified until it has been made red
 * (`RULE-a-regression-test-is-worth-nothing-until-you-have-watched-it`), and
 * the only other way to watch this one go red is to write an undeclared test
 * file into the real `test/` tree — which would put a deliberately broken file
 * in front of every other lane's `npm test` for as long as the proof runs.
 * `test/scripts/basis-gate.test.ts` plants its trees under the OS temp
 * directory instead. The CORPUS is never redirected: ids still resolve against
 * the real one, so a planted declaration is measured against real items.
 */
export function rootFrom(argv: string[]): string {
  const at = argv.indexOf('--root');
  return at === -1 || argv[at + 1] === undefined ? REPO : path.resolve(argv[at + 1]!);
}

function main(): number {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const quiet = argv.includes('--quiet');
  const showUndeclared = argv.includes('--undeclared');
  const showItems = argv.includes('--items');
  const root = rootFrom(argv);
  const write = (s: string): void => {
    process.stdout.write(`${s}\n`);
  };

  const ws = resolveWorkspace(process.cwd());
  if (ws.projectRoot === null) {
    write(
      'my_context: no workspace here — nothing was checked, which is not the same as nothing ' +
        'being wrong. Run this from a directory inside the project.',
    );
    return 1;
  }
  const errors: LoadError[] = [];
  const items = loadLayer(ws.projectRoot, 'project', errors, ws.config);
  // The vacuous pass, refused: a corpus with nothing in it resolves nothing, so
  // every declaration would read as dangling and every silence as fine.
  if (items.length === 0) {
    write(
      `my_context: no items under ${ws.projectRoot} — nothing was checked, which is not the ` +
        'same as nothing being wrong. Run this from the repository root.',
    );
    return 1;
  }
  const corpus = readCorpus(items, ws.config);

  const files = testFiles(root);
  if (files.length === 0) {
    write(
      `my_context: no test files under ${TEST_ROOTS.map((r) => r.root).join(', ')} — nothing ` +
        'was checked, which is not the same as nothing being wrong.',
    );
    return 1;
  }

  let baseline: string[];
  try {
    baseline = parseBaseline(readFileSync(path.join(root, ...BASELINE_FILE.split('/')), 'utf8'));
  } catch {
    write(
      `my_context: ${BASELINE_FILE} is missing or unreadable. Without it every test file that ` +
        'predates the rule reads as a new one, and this gate would demand hundreds of ' +
        'declarations nobody can honestly write. Refusing rather than reporting them.',
    );
    return 1;
  }

  const report = build(root, files, baseline, corpus);

  if (asJson) {
    write(JSON.stringify({
      ...report,
      covers: Object.fromEntries(report.covers),
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
    }, null, 2));
    return report.findings.some((f) => f.gates) ? 1 : 0;
  }
  if (!quiet) {
    const body = render(report);
    if (body !== '') process.stdout.write(`${body}\n`);
    if (showUndeclared) {
      for (const f of report.undeclaredBaselined) write(`UNDECLARED ${f}`);
      for (const f of report.baselineDead) write(`SPENT      ${f} — no such file`);
      for (const f of report.baselineSpent) write(`SPENT      ${f} — now declares a basis`);
      write('');
    }
    if (showItems) {
      write(renderItems(report, items));
      write('');
    }
  }
  write(summary(report, showUndeclared));
  for (const e of errors) write(`load error: ${e.file}: ${e.message}`);
  return report.findings.some((f) => f.gates) ? 1 : 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) process.exit(main());
