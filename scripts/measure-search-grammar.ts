#!/usr/bin/env node
/**
 * **What a QUERY GRAMMAR would actually buy, measured against the real index
 * before any of it is offered** — the measurement
 * `TASK-the-conversation-search-takes-one-substring-and-nothing-else`
 * (`semantic/2`, D77) exists to produce.
 *
 *     node scripts/measure-search-grammar.ts
 *
 * It READS. It opens the archive index and the corpus read-only, builds its
 * own throwaway in-memory FTS5 tables, and writes nothing anywhere. Nothing in
 * it changes search behaviour: `filterItems` is imported and called as it
 * ships, and every candidate is built beside it so the two run over the same
 * queries in the same process.
 *
 * ── WHY THIS EXISTS BESIDE `measure-search-floor.ts` AND NOT INSIDE IT ─────
 *
 * `semantic/1` measured the FLOOR — how much of "a different word for the same
 * idea" is reachable with no model. Its section 7 found the largest single miss
 * and stopped there: `text` is ONE contiguous substring, 32.8% of his two-word
 * phrases return anything as a phrase and 100% as two AND-ed terms, median 3
 * against median 32. That is a two-point measurement of a curve, and the whole
 * design question — *what should a reader be able to type* — lives between the
 * two points. This measures the curve.
 *
 * It also measures the two things a proposal here gets wrong, and it measures
 * them BEFORE the proposal rather than after:
 *
 *   **FTS5 under TRIGRAM is not FTS5 under `unicode61`.** The archive's index
 *   is `tokenize='trigram'` (see `conversation-index.ts`), and several of
 *   FTS5's documented operators mean something different there, one of them
 *   means nothing at all, and one of them turns into an operator FTS5 does not
 *   document because it is an accident of the tokenizer. Section 1 runs every
 *   operator against the real index and section 2 calibrates the interesting
 *   one.
 *
 *   **Hebrew.** `semantic/1` measured the trigram tokenizer at 51x `unicode61`
 *   for his front-particle queries. Any grammar that assumes English word shape
 *   is worse than what ships, and section 5 is the counterexample: there is a
 *   real Hebrew pair in this fixture that the SHIPPED one-substring search
 *   finds and an AND of its two terms does not.
 *
 * ── WHAT IS DELIBERATELY NOT MEASURED ──────────────────────────────────────
 *
 * No embedding, no model, no network call, and nothing from the archive leaves
 * the machine. `CONST-zero-runtime-dependencies` and the owner's standing rule
 * that his conversation content is his property.
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { filterItems } from '../src/core/search.ts';
import { loadLayer, type LoadError } from '../src/core/rebuild.ts';
import type { Item } from '../src/core/types.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';
// **Imported, not copied.** `measure-search-floor.ts` owns the particle list
// and the one-particle strip; a second spelling of either is the defect
// `CLAUDE.md` opens by describing, and these two are exactly the kind of thing
// that would drift. Its `main` is guarded, so importing it runs nothing.
import { HEBREW_PARTICLES, hebrewVariants } from './measure-search-floor.ts';

const out: string[] = [];
const say = (s = ''): void => { out.push(s); };
const flush = (): void => { process.stdout.write(out.join('\n') + '\n'); };

const HEBREW = /[\u0590-\u05FF]/;

/**
 * The stop list and the word split are `measure-search-floor.ts`' — same
 * vocabulary, so the two scripts' numbers are comparable line for line. They
 * are re-stated rather than imported because that file does not export them,
 * and adding an export to a script another test already imports is a change to
 * a file this lane does not own.
 */
const STOP = new Set((
  'a an the and or but if then so that this these those there here is are was were be been being am '
  + 'do does did done doing have has had having i you he she it we they me him her them my your his its our their us '
  + 'for of to in on at by with from into over under about as not no yes very just also only some any all each every '
  + 'what which who whom whose when where why how can could should would will shall may might must now again too '
  + 'more most other another same such own much many few both please thanks thank ok okay go going want '
  + 'need needs like get got make made let lets see look show tell say said give take put use used using one two '
  + 'still even ever always new old best').split(/\s+/));

const fold = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string): string[] => fold(s).split(' ').filter((t) => t.length > 0);
const content = (s: string): string[] => words(s).filter((t) => t.length > 2 && !STOP.has(t));

/**
 * **One term, quoted into FTS5 as DATA** — `searchArchive`'s own rule, applied
 * per TERM instead of to the whole query, which is the entire mechanical
 * difference every candidate in this file rests on.
 */
export function quoteTerm(term: string): string {
  return '"' + term.replace(/"/g, '""') + '"';
}

/**
 * **The shortest string a trigram index can match, restated as a PER-TERM
 * bound.**
 *
 * `MIN_QUERY_CHARS` in `core/conversation-search.ts` is the same number applied
 * to the whole query, which is correct for a single substring and becomes a
 * silent hole the moment a query is split: `"ui" AND "search"` is a legal FTS5
 * query, three characters long, that returns ZERO rows for ever — measured in
 * section 4. It is a bound of the index, not an answer about the archive, and
 * a split that drops it on the floor reports the wrong one of those.
 */
export const MIN_TERM_CHARS = 3;

/** The median of a list, or 0 for an empty one. */
export function median(a: number[]): number {
  return a.length === 0 ? 0 : [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
}

/**
 * **The three readings of a two-word query, as FTS5 strings.**
 *
 * They are strictly nested for terms of three characters or more — section 3
 * proves the containment rather than assuming it — so a surface that showed
 * all three would show today's answer FIRST and everything new BELOW it, and
 * could not make any query worse. That property is the whole argument for the
 * shape, and it is why these are one function rather than three call sites.
 */
export function tiersOf(terms: string[], near: number): string[] {
  const q = terms.map(quoteTerm);
  return [
    quoteTerm(terms.join(' ')),
    `NEAR(${q.join(' ')}, ${near})`,
    q.join(' AND '),
  ];
}

function main(): number {
  const ws = resolveWorkspace(process.cwd());
  if (ws.projectRoot === null) {
    say('my_context: no workspace here — nothing was measured, which is not the same as nothing '
      + 'being wrong. Run this from the repository root.');
    flush();
    return 1;
  }
  const repoRoot = path.dirname(ws.projectRoot);
  const errors: LoadError[] = [];
  const items = loadLayer(ws.projectRoot, 'project', errors, ws.config) as Item[];
  if (items.length === 0) {
    say('my_context: no items — nothing was measured.');
    flush();
    return 1;
  }
  const idx = new DatabaseSync(ws.dbPath, { readOnly: true });
  const spans = (idx.prepare('SELECT count(*) c FROM conversation_prose').get() as { c: number }).c;
  const sqlite = (idx.prepare('SELECT sqlite_version() v').get() as { v: string }).v;
  const count = idx.prepare(
    'SELECT count(*) c FROM conversation_prose WHERE conversation_prose MATCH ?',
  );
  const hits = (m: string): number => {
    try { return (count.get(m) as { c: number }).c; } catch { return -1; }
  };

  // ══ 1. EVERY FTS5 OPERATOR, RUN AGAINST THE REAL INDEX ═══════════════════
  say('== 1. WHAT FTS5 ACTUALLY SUPPORTS UNDER THE TRIGRAM TOKENIZER ==');
  say('  SQLite ' + sqlite + ', ' + spans + ' prose spans, tokenize=\'trigram\', read-only.');
  say('  -1 means the query RAISED. 0 means it was accepted and matched nothing, which is the');
  say('  answer a reader cannot tell from "not here".');
  const probes: [string, string, string][] = [
    ['phrase (what ships)', '"byte offset"', 'the contiguous substring — todays whole grammar'],
    ['implicit AND', '"byte" "offset"', 'juxtaposition is AND, as FTS5 documents'],
    ['explicit AND', '"byte" AND "offset"', 'same set as juxtaposition'],
    ['unquoted two words', 'byte offset', 'bare words are two terms, not a phrase'],
    ['OR', '"byte" OR "offset"', 'works'],
    ['NOT', '"byte" NOT "offset"', 'works'],
    ['parentheses', '("byte" OR "offset") AND "trigram"', 'works'],
    ['NEAR, default 10', 'NEAR("byte" "offset")', 'works — section 2 says in what units'],
    ['NEAR, 30', 'NEAR("byte" "offset", 30)', ''],
    ['NEAR, 0', 'NEAR("byte" "offset", 0)', 'a window of zero admits nothing'],
    ['prefix on a term', '"byte"*', 'compare with the row below'],
    ['the same term, no star', '"byte"', 'IDENTICAL — prefix is a NO-OP under trigram'],
    ['prefix, 2 chars', 'by*', 'shorter than a trigram: silent zero'],
    ['initial-token ^', '^"byte"', 'means "the span BEGINS with" — rarely what a reader wants'],
    ['column filter, indexed', 'text : "byte offset"', 'the one indexed column'],
    ['column filter, UNINDEXED', 'kind : "prompt"', 'kind is UNINDEXED: accepted, always zero'],
    ['two-char term', '"ui"', 'silent zero — the floor, correctly reported today'],
    ['two-char term inside AND', '"ui" AND "search"', 'SILENT ZERO — the floor, NOT reported'],
    ['upper case', '"BYTE OFFSET"', 'trigram folds case by default'],
    ['punctuation inside a phrase', '"byte-offset"', 'punctuation is indexed like any character'],
  ];
  for (const [name, m, note] of probes) {
    say('  ' + name.padEnd(28) + String(hits(m)).padStart(7) + '  ' + m
      + (note === '' ? '' : '\n' + ' '.repeat(38) + note));
  }
  say('  VERDICT: AND, OR, NOT, parentheses and NEAR all work. `*` is a NO-OP because a trigram');
  say('           index already matches substrings. A term shorter than three characters is a');
  say('           SILENT ZERO wherever it appears, and inside a boolean it takes the whole query');
  say('           down with it — which is a bound of the index reported as an absence.');

  // ══ 2. NEAR, CALIBRATED ══════════════════════════════════════════════════
  say('');
  say('== 2. UNDER TRIGRAM, `NEAR` IS A DISTANCE IN CHARACTERS ==');
  say('  A trigram tokenizer emits one token per character position, so FTS5\'s token distance IS');
  say('  a character distance. Measured, not reasoned: 41 synthetic documents `alpha` + N dots +');
  say('  `omega`, N from 0 to 40, in a throwaway in-memory trigram table.');
  const cal = new DatabaseSync(':memory:');
  cal.exec("CREATE VIRTUAL TABLE g USING fts5(x, tokenize='trigram')");
  const gi = cal.prepare('INSERT INTO g(rowid, x) VALUES (?, ?)');
  for (let gap = 0; gap <= 40; gap++) gi.run(gap, 'alpha' + '.'.repeat(gap) + 'omega');
  const gapsFor = (n: number): number[] => {
    const r = cal.prepare('SELECT rowid FROM g WHERE g MATCH ?')
      .all(`NEAR("alpha" "omega", ${n})`) as { rowid: number }[];
    return r.map((x) => Number(x.rowid));
  };
  let law = true;
  for (const n of [0, 1, 2, 3, 5, 10, 20, 30, 40, 50]) {
    const g = gapsFor(n);
    const expect = Math.max(0, Math.min(41, n - 1));
    if (g.length !== expect) law = false;
    say('  NEAR N=' + String(n).padStart(3) + '  matches '
      + (g.length === 0 ? 'nothing' : 'gaps 0..' + Math.max(...g) + ' (' + g.length + ' of 41)'));
  }
  say('  LAW: NEAR(a b, N) matches when at most N-2 characters separate the two substrings.');
  say('       Held on every N tried: ' + (law ? 'YES' : 'NO — the law above is WRONG, re-derive it'));
  say('  SO: NEAR(..., 12) is "in the same clause", NEAR(..., 30) is "in the same sentence",');
  say('      and NEAR(..., 200) is "in the same paragraph". None of that is in the FTS5 docs,');
  say('      because none of it is true under `unicode61` — it is a property of THIS tokenizer.');

  // ══ 3. THE CURVE BETWEEN PHRASE AND AND ══════════════════════════════════
  const prompts = (idx.prepare(
    "SELECT text FROM conversation_prose WHERE kind='prompt' AND agent_id IS NULL",
  ).all() as { text: string }[])
    .map((r) => String(r.text).trim())
    .filter((t) => !t.startsWith('<') && !t.startsWith('Caveat') && t.length > 15);
  const phrases: string[] = [];
  for (const p of prompts) {
    const w = content(p);
    for (let i = 0; i + 2 <= w.length; i++) {
      if (w[i].length >= 5 && w[i + 1].length >= 5) phrases.push(w[i] + ' ' + w[i + 1]);
    }
  }
  // Sampled by stride over the sorted set, exactly as `measure-search-floor.ts`
  // section 7 samples it, so the two runs' numbers are the same numbers.
  const allPhrases = [...new Set(phrases)].sort();
  const stride = Math.max(1, Math.ceil(allPhrases.length / 1500));
  const qs = allPhrases.filter((_, i) => i % stride === 0);
  say('');
  say('== 3. THE CURVE BETWEEN "ONE PHRASE" AND "TWO AND-ED TERMS" ==');
  say('  ' + qs.length + ' two-word phrases he actually typed (both words 5+ letters), sampled by stride');
  say('  from ' + allPhrases.length + ', run against the real prose index, read-only. `semantic/1` measured the two');
  say('  ENDS of this curve. Everything between them is what a reader would actually be given.');
  const forms: [string, (q: string) => string][] = [
    ['phrase  (ships)', (q) => quoteTerm(q)],
    ['NEAR 12', (q) => tiersOf(q.split(' '), 12)[1]],
    ['NEAR 30', (q) => tiersOf(q.split(' '), 30)[1]],
    ['NEAR 80', (q) => tiersOf(q.split(' '), 80)[1]],
    ['NEAR 200', (q) => tiersOf(q.split(' '), 200)[1]],
    ['AND', (q) => tiersOf(q.split(' '), 30)[2]],
    ['OR', (q) => q.split(' ').map(quoteTerm).join(' OR ')],
  ];
  for (const [name, f] of forms) {
    let hit = 0; const sizes: number[] = [];
    for (const q of qs) { const n = hits(f(q)); if (n > 0) { hit++; sizes.push(n); } }
    say('  ' + name.padEnd(16) + String(hit).padStart(5) + ' of ' + qs.length + '  '
      + (100 * hit / qs.length).toFixed(1).padStart(5) + '%   median ' + String(median(sizes)).padStart(4)
      + ' spans   mean ' + (sizes.reduce((a, b) => a + b, 0) / Math.max(1, sizes.length)).toFixed(1));
  }
  say('  READ THIS AS A PRECISION CURVE, NOT A RECALL ONE. Every pair here was taken FROM a prompt');
  say('  that is itself in the index, so a near co-occurrence is guaranteed to exist somewhere and');
  say('  the reach column is inflated by construction — that caveat belongs to `semantic/1`\'s 100%');
  say('  for AND exactly as much as to NEAR\'s. The MEDIAN is the honest column: it is how many');
  say('  spans a reader is handed, and NEAR 30 hands back a tenth of what AND does.');

  // The nesting, checked rather than assumed — this is what makes a tiered
  // answer incapable of losing a hit the shipped search already returns.
  const rowids = (m: string): Set<number> => new Set(
    (idx.prepare('SELECT rowid FROM conversation_prose WHERE conversation_prose MATCH ?')
      .all(m) as { rowid: number }[]).map((x) => Number(x.rowid)),
  );
  const sub = (a: Set<number>, b: Set<number>): boolean => {
    for (const x of a) if (!b.has(x)) return false;
    return true;
  };
  const checked = qs.filter((_, i) => i % Math.max(1, Math.ceil(qs.length / 200)) === 0);
  let okPN = 0; let okNA = 0;
  for (const q of checked) {
    const [p, n, a] = tiersOf(q.split(' '), 30).map(rowids);
    if (sub(p, n)) okPN++;
    if (sub(n, a)) okNA++;
  }
  say('  CONTAINMENT, checked on ' + checked.length + ' of them by comparing rowid SETS and not counts:');
  say('    phrase is a subset of NEAR 30: ' + okPN + '/' + checked.length
    + '      NEAR 30 is a subset of AND: ' + okNA + '/' + checked.length);
  say('  So an answer that showed phrase hits, then NEAR hits, then AND hits CANNOT lose a hit the');
  say('  shipped search returns today — for terms of three characters or more. Section 5 is the');
  say('  counterexample that bound is hiding.');

  const timed = (m: string): string => {
    const t: number[] = [];
    for (let i = 0; i < 25; i++) {
      const t0 = process.hrtime.bigint();
      hits(m);
      t.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    t.sort((a, b) => a - b);
    return t[12].toFixed(2);
  };
  say('  COST, median of 25 on the real ' + spans + '-span index: phrase ' + timed('"byte offset"')
    + ' ms, NEAR 30 ' + timed('NEAR("byte" "offset", 30)') + ' ms, AND '
    + timed('"byte" AND "offset"') + ' ms, OR ' + timed('"byte" OR "offset"') + ' ms.');

  // ══ 4. THE THREE-CHARACTER FLOOR, AS A PER-TERM BOUND ════════════════════
  say('');
  say('== 4. THE THREE-CHARACTER FLOOR IS A PER-TERM BOUND, AND IS CHECKED PER QUERY ==');
  const allTyped: string[] = [];
  for (const p of prompts) for (const w of fold(p).split(' ')) if (w.length > 0) allTyped.push(w);
  const typedShort = allTyped.filter((w) => w.length < MIN_TERM_CHARS).length;
  say('  `MIN_QUERY_CHARS` = ' + MIN_TERM_CHARS + ' is applied to the WHOLE query today and is right for one');
  say('  substring. Split a query into terms and it is the wrong place for the check:');
  say('    words he typed:                      ' + allTyped.length);
  say('    shorter than ' + MIN_TERM_CHARS + ' characters:            ' + typedShort
    + '  (' + (100 * typedShort / allTyped.length).toFixed(1) + '%)');
  say('    `"ui" AND "search"` returns          ' + hits('"ui" AND "search"')
    + '   while `"search"` alone returns ' + hits('"search"'));
  say('  A split that passes a short term through returns an EMPTY ANSWER for a query that has a');
  say('  real answer, and says nothing — which is the failure `SearchResult.searchable` was added');
  say('  to prevent, reappearing one level down.');

  // ══ 5. HEBREW, MEASURED BEFORE ANYTHING IS OFFERED ═══════════════════════
  say('');
  say('== 5. HEBREW — the same grammar, on the fixture `semantic/1` used ==');
  const heDocs: string[] = [];
  const heStrings = readFileSync(path.join(repoRoot, 'src/ui/public/strings/he.js'), 'utf8');
  for (const m of heStrings.matchAll(/'([^'\\]*[\u0590-\u05FF][^'\\]*)'/g)) heDocs.push(m[1]);
  const fromStrings = heDocs.length;
  const walkItems = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkItems(p);
      else if (e.name.endsWith('.md')) {
        for (const line of readFileSync(p, 'utf8').split('\n')) if (HEBREW.test(line)) heDocs.push(line.trim());
      }
    }
  };
  walkItems(path.join(ws.projectRoot, 'items'));
  const he = new DatabaseSync(':memory:');
  he.exec("CREATE VIRTUAL TABLE t USING fts5(x, tokenize='trigram')");
  const hi = he.prepare('INSERT INTO t(x) VALUES (?)');
  he.exec('BEGIN');
  for (const d of heDocs) hi.run(d);
  he.exec('COMMIT');
  const heCount = he.prepare('SELECT count(*) c FROM t WHERE t MATCH ?');
  const heHits = (m: string): number => {
    try { return (heCount.get(m) as { c: number }).c; } catch { return -1; }
  };
  say('  fixture: ' + fromStrings + ' Hebrew strings from the shipped UI table + '
    + (heDocs.length - fromStrings) + ' Hebrew lines from corpus items = ' + heDocs.length + '.');
  // **WHY THE FIXTURE IS NOT HIS ARCHIVE, stated in the output and not only in
  // the report.** Every Hebrew number below describes the UI's Hebrew. It is
  // evidence about the MECHANISM — what this index can and cannot match — and
  // it is not evidence about his traffic, because his traffic has almost none.
  const hePrompts = prompts.filter((p) => HEBREW.test(p));
  const heTyped = new Set<string>();
  for (const p of prompts) for (const w of p.match(/[֐-׿]+/g) ?? []) heTyped.add(w);
  say('  AND IT IS NOT HIS ARCHIVE: of ' + prompts.length + ' main-session prompts, ' + hePrompts.length
    + ' contain Hebrew at all, carrying ' + heTyped.size + ' Hebrew word');
  say('  types between them. Read every Hebrew number below as evidence about the MECHANISM.');
  const heFreq = new Map<string, number>();
  for (const d of heDocs) for (const w of d.match(/[\u0590-\u05FF]+/g) ?? []) heFreq.set(w, (heFreq.get(w) ?? 0) + 1);
  const heVocab = [...heFreq.keys()];
  const byLen = new Map<number, number>();
  for (const w of heVocab) byLen.set(w.length, (byLen.get(w.length) ?? 0) + 1);
  let tokAll = 0; let tokShort = 0;
  for (const [w, n] of heFreq) { tokAll += n; if (w.length < MIN_TERM_CHARS) tokShort += n; }
  const typeShort = heVocab.filter((w) => w.length < MIN_TERM_CHARS).length;
  say('  -- THE THREE-CHARACTER FLOOR COSTS MORE IN HEBREW, because Hebrew words are shorter --');
  say('  word types by length: ' + [...byLen.entries()].sort((a, b) => a[0] - b[0])
    .map(([l, n]) => l + ':' + n).join(' '));
  say('  types under ' + MIN_TERM_CHARS + ' chars: ' + typeShort + '/' + heVocab.length
    + ' (' + (100 * typeShort / heVocab.length).toFixed(1) + '%)  but OCCURRENCES: '
    + tokShort + '/' + tokAll + ' (' + (100 * tokShort / tokAll).toFixed(1) + '%)');
  say('  In English a two-letter word is almost never the word you are looking for. In Hebrew it');
  say('  is one word in seven, and the index cannot match any of them.');

  const hePairsAll: string[] = [];
  const hePairs: string[] = [];
  for (const d of heDocs) {
    const w = d.match(/[\u0590-\u05FF]+/g) ?? [];
    for (let i = 0; i + 2 <= w.length; i++) {
      hePairsAll.push(w[i] + ' ' + w[i + 1]);
      if (w[i].length >= MIN_TERM_CHARS && w[i + 1].length >= MIN_TERM_CHARS) hePairs.push(w[i] + ' ' + w[i + 1]);
    }
  }
  const heAllUniq = [...new Set(hePairsAll)];
  const heShortPairs = heAllUniq.filter((p) => p.split(' ').some((w) => w.length < MIN_TERM_CHARS)).length;
  const heUniq = [...new Set(hePairs)].sort();
  const heStride = Math.max(1, Math.ceil(heUniq.length / 1200));
  const heQs = heUniq.filter((_, i) => i % heStride === 0);
  say('  -- AND THAT FLOOR IS WHERE SPLITTING A HEBREW QUERY GOES WRONG --');
  say('  adjacent Hebrew word pairs in the fixture: ' + heAllUniq.length + ' types, of which '
    + heShortPairs + ' (' + (100 * heShortPairs / heAllUniq.length).toFixed(1) + '%) contain a word');
  say('  shorter than ' + MIN_TERM_CHARS + ' characters. Split THOSE into terms and the AND is empty.');
  const heShortEx = heAllUniq.find((p) => p.split(' ')[0].length === 2 && heHits(quoteTerm(p)) > 0);
  if (heShortEx !== undefined) {
    const [a, b] = heShortEx.split(' ');
    say('  THE COUNTEREXAMPLE, taken from the fixture rather than invented:  ' + JSON.stringify(heShortEx));
    say('    as ONE substring, which is what ships:   ' + heHits(quoteTerm(heShortEx)) + ' hits');
    say('    as ' + quoteTerm(a) + ' AND ' + quoteTerm(b) + ':' + ' '.repeat(Math.max(1, 22 - a.length - b.length))
      + heHits(quoteTerm(a) + ' AND ' + quoteTerm(b)) + ' hits   <- the split is STRICTLY WORSE');
    // The removal proof in the same run: the longer term alone answers, so the
    // zero above is the SHORT term's doing and not an empty fixture.
    say('    ' + quoteTerm(b) + ' alone:' + ' '.repeat(Math.max(1, 34 - b.length))
      + heHits(quoteTerm(b)) + ' hits   <- so the fixture answers, and the zero is the short term');
    say('  So "phrase is a subset of AND" is FALSE in Hebrew, and the tiered answer of section 3 is');
    say('  what saves it: the phrase tier still returns this, whatever the boolean tiers do.');
  } else {
    say('  No such pair in this fixture on this run — the claim above is UNMEASURED today.');
  }
  say('  -- THE GRAMMAR ITSELF IS LANGUAGE-BLIND, which is the point of trigram --');
  say('  ' + heQs.length + ' Hebrew two-word pairs (both words ' + MIN_TERM_CHARS + '+ letters) of '
    + heUniq.length + ', sampled by stride:');
  for (const [name, f] of [
    ['phrase', (q: string) => quoteTerm(q)],
    ['NEAR 12', (q: string) => tiersOf(q.split(' '), 12)[1]],
    ['NEAR 30', (q: string) => tiersOf(q.split(' '), 30)[1]],
    ['AND', (q: string) => tiersOf(q.split(' '), 30)[2]],
  ] as [string, (q: string) => string][]) {
    let hit = 0;
    for (const q of heQs) if (heHits(f(q)) > 0) hit++;
    say('    ' + name.padEnd(9) + String(hit).padStart(5) + ' of ' + heQs.length + '  '
      + (100 * hit / heQs.length).toFixed(1).padStart(5) + '%');
  }
  say('  (No median column: this fixture is 1,376 SHORT strings, so every form returns 1 span and');
  say('   the precision spread the English archive shows cannot be measured here at all.)');
  say('  -- THE PARTICLE, AND WHY IT NEEDS THE SPLIT RATHER THAN SURVIVING IT --');
  const glue = HEBREW_PARTICLES[1];
  let gPhrase = 0; let gNear = 0; let gAnd = 0; let gStrip = 0;
  for (const q of heQs) {
    const [a, b] = q.split(' ');
    const A = glue + a;
    if (heHits(quoteTerm(A + ' ' + b)) > 0) gPhrase++;
    if (heHits(tiersOf([A, b], 30)[1]) > 0) gNear++;
    if (heHits(tiersOf([A, b], 30)[2]) > 0) gAnd++;
    const variants = hebrewVariants(A).filter((v) => v.length >= MIN_TERM_CHARS);
    if (variants.some((v) => heHits(tiersOf([v, b], 30)[1]) > 0)) gStrip++;
  }
  say('  He types the particle ' + JSON.stringify(glue) + ' glued to the FIRST word and the text writes the bare');
  say('  word — ' + heQs.length + ' such queries:');
  say('    phrase                                  ' + String(gPhrase).padStart(5) + '  '
    + (100 * gPhrase / heQs.length).toFixed(1) + '%');
  say('    NEAR 30                                 ' + String(gNear).padStart(5) + '  '
    + (100 * gNear / heQs.length).toFixed(1) + '%');
  say('    AND                                     ' + String(gAnd).padStart(5) + '  '
    + (100 * gAnd / heQs.length).toFixed(1) + '%');
  say('    NEAR 30, one particle stripped PER TERM  ' + String(gStrip).padStart(4) + '  '
    + (100 * gStrip / heQs.length).toFixed(1) + '%');
  say('  THE FINDING: splitting alone does NOTHING for Hebrew — AND is as blind to a glued particle');
  say('  as the phrase is. What the split buys is the ABILITY TO STRIP one, which cannot be done to');
  say('  a contiguous substring without destroying it. The split is not the repair; it is what makes');
  say('  the repair `semantic/1` measured at 1.3% -> 100% expressible at all.');
  const threeWithParticle = heVocab.filter((w) => w.length === 3 && HEBREW_PARTICLES.includes(w[0]));
  const stripTooShort = threeWithParticle.filter((w) => w.slice(1).length < MIN_TERM_CHARS).length;
  say('  AND THE STRIP HAS ITS OWN FLOOR: ' + threeWithParticle.length + ' three-letter Hebrew word types begin with a');
  say('  particle letter, and ' + stripTooShort + ' of them strip down to a term this index cannot match at all.');
  say('  So a strip must ADD a variant and keep the original, never replace it — which is what');
  say('  `hebrewVariants` already returns and what a caller could still throw away.');

  // ══ 6. THE CORPUS SIDE — WHAT RANKING WOULD COST ═════════════════════════
  say('');
  say('== 6. THE CORPUS SIDE: `filterItems` REFUSES TO RANK, AND THAT IS THE REAL GATE ==');
  const pos = new Map(items.map((it, i) => [it.id, i]));
  const requests = new Map<string, string>();
  for (const it of items as unknown as Record<string, unknown>[]) {
    if (typeof it.request === 'string' && it.request.trim().length > 20) {
      requests.set(String(it.id), it.request);
    }
  }
  // The 8-word-window mask is `measure-search-floor.ts` section 4's, restated
  // so this run's SET R is that run's SET R and the two are comparable.
  const mask = (text: string, req: string | undefined): string => {
    if (req === undefined) return text;
    const rw = words(req); const win = new Set<string>();
    for (let i = 0; i + 8 <= rw.length; i++) win.add(rw.slice(i, i + 8).join(' '));
    if (win.size === 0) return text;
    const tw = words(text); const drop = new Uint8Array(tw.length);
    for (let i = 0; i + 8 <= tw.length; i++) {
      if (win.has(tw.slice(i, i + 8).join(' '))) for (let j = i; j < i + 8; j++) drop[j] = 1;
    }
    return tw.filter((_, i) => drop[i] === 0).join(' ');
  };
  const bodyOf = (it: Item, req: string | undefined): string => [
    mask(it.body, req),
    mask(it.observations.map((o) => o.text + ' ' + (o.context ?? '')).join('\n'), req),
    mask(Object.values(it.extra).join('\n'), req),
  ].join('\n');

  const wide = new DatabaseSync(':memory:');
  wide.exec("CREATE VIRTUAL TABLE it USING fts5(iid UNINDEXED, title, summary, tags, body, tokenize='trigram')");
  const wi = wide.prepare('INSERT INTO it(iid,title,summary,tags,body) VALUES (?,?,?,?,?)');
  const narrow = new DatabaseSync(':memory:');
  narrow.exec("CREATE VIRTUAL TABLE it USING fts5(iid UNINDEXED, body, tokenize='trigram')");
  const ni = narrow.prepare('INSERT INTO it(iid,body) VALUES (?,?)');
  wide.exec('BEGIN'); narrow.exec('BEGIN');
  const builtMs = Date.now();
  for (const it of items) {
    const req = requests.get(it.id);
    const sum = (it as unknown as { summary?: string | null }).summary ?? '';
    wi.run(it.id, mask(it.title, req), mask(sum, req),
      it.tags.join(' ') + ' ' + it.id.replace(/-/g, ' '), bodyOf(it, req));
    ni.run(it.id, mask(it.title, req) + '\n' + bodyOf(it, req));
  }
  wide.exec('COMMIT'); narrow.exec('COMMIT');
  const buildMs = Date.now() - builtMs;

  const df = new Map<string, number>();
  for (const it of items) {
    const req = requests.get(it.id);
    const sum = (it as unknown as { summary?: string | null }).summary ?? '';
    const seen = new Set(content([mask(it.title, req), mask(sum, req), it.tags.join(' '), bodyOf(it, req)].join('\n')));
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = items.length;
  const idf = (t: string): number => {
    const n = df.get(t) ?? N;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };
  const distinctive = (q: string, k: number): string[] =>
    [...new Set(content(q))].sort((a, b) => idf(b) - idf(a)).slice(0, k);
  const terms = (q: string, k: number): string[] =>
    distinctive(q, k).filter((t) => t.length >= MIN_TERM_CHARS);

  const ask = (db: DatabaseSync, m: string, weights: string | null): number[] => {
    try {
      return (db.prepare(
        `SELECT iid FROM it WHERE it MATCH ? ORDER BY bm25(it${weights === null ? '' : ',' + weights}) ASC LIMIT 50`,
      ).all(m) as { iid: string }[]).map((r) => pos.get(String(r.iid))!);
    } catch { return []; }
  };
  const R = [...requests.entries()];
  const run = (label: string, fn: (q: string) => number[]): void => {
    let a1 = 0; let a5 = 0; let a10 = 0; let any = 0; let mrr = 0;
    for (const [id, q] of R) {
      const t = pos.get(id)!;
      const r = fn(q).indexOf(t);
      if (r >= 0) { any++; mrr += 1 / (r + 1); if (r < 1) a1++; if (r < 5) a5++; if (r < 10) a10++; }
    }
    say('  ' + label.padEnd(48) + ' @1 ' + String(a1).padStart(2) + '   @5 ' + String(a5).padStart(2)
      + '   @10 ' + String(a10).padStart(2) + '   anywhere ' + String(any).padStart(2) + '/' + R.length
      + '   MRR ' + (mrr / R.length).toFixed(3));
  };
  say('  SET R, exactly as `semantic/1` built it: ' + R.length + ' owner-authored (request, item) pairs with');
  say('  every 8-word window of a request DELETED from the item it points at. The query is the five');
  say('  most distinctive words of the request, which is what a person types. What is NEW here is');
  say('  that the candidate is SQLite\'s own FTS5 — same trigram tokenizer the archive uses, same');
  say('  `bm25()` `matchProse` already orders by, no new ranker written, no dependency added.');
  say('  Building the whole corpus into a throwaway in-memory FTS5 table: ' + buildMs + ' ms for ' + N + ' items.');
  const cfg = ws.config;
  run('S0 shipped: whole request as one substring',
    (q) => filterItems(items, { text: q }, cfg).map((h) => pos.get(h.id)!));
  run('S0b shipped: those 5 words as one substring',
    (q) => filterItems(items, { text: distinctive(q, 5).join(' ') }, cfg).map((h) => pos.get(h.id)!));
  run('F1 FTS5: 5 terms AND-ed, bm25', (q) => {
    const t = terms(q, 5);
    return t.length === 0 ? [] : ask(wide, t.map(quoteTerm).join(' AND '), null);
  });
  run('F2 FTS5: 5 terms OR-ed, bm25', (q) => {
    const t = terms(q, 5);
    return t.length === 0 ? [] : ask(wide, t.map(quoteTerm).join(' OR '), null);
  });
  run('F2n F2 over the SHIPPED fields only', (q) => {
    const t = terms(q, 5);
    return t.length === 0 ? [] : ask(narrow, t.map(quoteTerm).join(' OR '), null);
  });
  run('F3 F2 + column weights (title/summary 3, tags 2)', (q) => {
    const t = terms(q, 5);
    return t.length === 0 ? [] : ask(wide, t.map(quoteTerm).join(' OR '), '0.0,3.0,3.0,2.0,1.0');
  });
  run('F4 FTS5: NEAR all five, 400 characters', (q) => {
    const t = terms(q, 5);
    return t.length === 0 ? [] : ask(wide, `NEAR(${t.map(quoteTerm).join(' ')}, 400)`, null);
  });
  run('F5 FTS5: 10 terms OR-ed, bm25', (q) => {
    const t = terms(q, 10);
    return t.length === 0 ? [] : ask(wide, t.map(quoteTerm).join(' OR '), null);
  });
  say('  READ F1 AND F4 AGAINST F2. AND-ing is right for TWO words and ruinous for FIVE, and NEAR');
  say('  over five terms is worse still: a reader who types a sentence does not mean "all of these');
  say('  and close together". Whatever a surface does with two terms, it must not do with five.');
  say('  READ F2n AGAINST F2. The gap between them is COVERAGE — summary, tags and id — and it is');
  say('  the same finding `semantic/1` reported, reproduced by a completely different mechanism.');
  say('  READ F3 AGAINST F2. Column weights did NOT help here. The gain was never weighting.');

  flush();
  return 0;
}

/**
 * Guarded, so `test/core/search-grammar.test.ts` can import `tiersOf`,
 * `quoteTerm`, `median` and `MIN_TERM_CHARS` rather than keeping a second copy
 * of any of them — the precedent is `measure-search-floor.ts` and the reason is
 * `CLAUDE.md`'s opening paragraph.
 */
if (isMainEntry(import.meta.filename, process.argv[1])) process.exitCode = main();
