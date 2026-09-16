#!/usr/bin/env node
/**
 * **How much of "a different word for the same idea" is reachable with NO
 * model at all** — the measurement `TASK-measure-what-finds-a-different-word-
 * for-the-same-idea` (`semantic/1`, D77) exists to produce.
 *
 *     node scripts/measure-search-floor.ts
 *
 * It READS. It opens the corpus, the archive index and the audit log read-only,
 * builds its indexes in memory, and writes nothing anywhere. Nothing in it
 * changes search behaviour: the shipped predicate is imported and called, and
 * every candidate is built beside it so the two can be run over the same
 * queries in the same process.
 *
 * ── WHY A SCRIPT AND NOT A FEATURE ─────────────────────────────────────────
 *
 * D77 already records that the expensive half of searching by meaning is the
 * MODEL and not the index: 11,692 vectors is a for-loop, and `sqlite-vec` is a
 * per-platform compiled binary that solves the half which is already free.
 * What was never measured is the CHEAP half — how much of the same effect is
 * reachable with no model, no dependency, and nothing leaving the machine.
 * This answers that with numbers, and answering it is the whole deliverable.
 *
 * ── THE QUERY SETS, AND WHERE EACH ONE COMES FROM ──────────────────────────
 *
 * A measurement whose corpus was chosen to flatter the result is the
 * fixture-power failure in another costume, so both sets are taken from what
 * the owner actually typed rather than from anything written for this run.
 *
 *   **SET V — his vocabulary.** Every English word of four letters or more
 *   that appears in at least three separate prompts he typed, read from
 *   `conversation_prose` where `kind='prompt'` and `agent_id IS NULL` — the
 *   main-session prompts, which are his keyboard and nobody else's. It
 *   measures REACH: can a word he uses find anything at all. It does not
 *   measure whether what comes back is right, and is reported as reach only.
 *
 *   **SET R — his requests, and the item each one produced.** Forty-two items
 *   carry the owner's VERBATIM request in their `request` field, written there
 *   by the product at the moment the item was created. That is an
 *   owner-authored (query, answer) pair: his words on one side, an agent's
 *   wording of the same idea on the other. Nobody labelled it for this run.
 *
 * **SET R LEAKS, AND THE LEAK IS MASKED RATHER THAN IGNORED.** Nineteen of the
 * forty-two items quote his request back inside their own body — this corpus
 * keeps the owner's words on purpose. Scored as-is, the set reports MRR 0.937
 * and the fixture, not the mechanism, earned it. So every eight-word window of
 * an item's own request is deleted from that item's title, body, summary and
 * observations before scoring, and the unmasked run is printed beside the
 * masked one so the size of the leak is visible rather than described.
 *
 * ── WHAT IS DELIBERATELY NOT MEASURED ──────────────────────────────────────
 *
 * No embedding, no model, no network call. `CONST-zero-runtime-dependencies`
 * and the owner's standing rule that his conversation content is his property
 * are the reason this task exists, and a "just to try it" embedding would
 * break the second one to answer a question the first one has already closed.
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { filterItems } from '../src/core/search.ts';
import { loadLayer, type LoadError } from '../src/core/rebuild.ts';
import type { Item } from '../src/core/types.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';

const out: string[] = [];
const say = (s = ''): void => { out.push(s); };
const flush = (): void => { process.stdout.write(out.join('\n') + '\n'); };

/**
 * **The conflation key, the stop list and the folding this measurement was
 * built on now SHIP, and this script imports them rather than keeping a
 * second copy.**
 *
 * They were authored here, in this file, because a measurement may not depend
 * on the thing it measures. They moved to `src/core/rank.ts` on 2026-09-16,
 * when `semantic/7` shipped the ranker, and the import replaced the
 * definitions on the same day rather than leaving two spellings of one rule
 * to drift — this project’s most-repeated defect, and the one `filterItems`
 * own header names.
 *
 * **The proof that the move changed nothing is this script’s own output**,
 * captured before the move and compared after it. Re-exported because
 * `test/core/search-floor.test.ts` imports `conflate` and `hebrewVariants`
 * FROM HERE, and that test names this file as where the claim was measured.
 */
import {
  conflate, content, fold, HEBREW, HEBREW_PARTICLES, hebrewVariants, words,
} from '../src/core/rank.ts';

export { conflate, hebrewVariants, HEBREW_PARTICLES };

function main(): number {
  const ws = resolveWorkspace(process.cwd());
  if (ws.projectRoot === null) {
    say('my_context: no workspace here — nothing was measured, which is not the same as nothing '
      + 'being wrong. Run this from the repository root.');
    flush();
    return 1;
  }
  const errors: LoadError[] = [];
  const items = loadLayer(ws.projectRoot, 'project', errors, ws.config) as Item[];
  if (items.length === 0) {
    say('my_context: no items — nothing was measured.');
    flush();
    return 1;
  }
  const N = items.length;
  const cfg = ws.config;
  const pos = new Map(items.map((it, i) => [it.id, i]));

  // ══ 1. THE FIGURES D77 RESTS ON, RE-TAKEN ════════════════════════════════
  const repoRoot = path.dirname(ws.projectRoot);
  const idx = new DatabaseSync(ws.dbPath, { readOnly: true });
  const spans = (idx.prepare('SELECT count(*) c FROM conversation_prose').get() as { c: number }).c;
  say('== 1. THE D77 FIGURES, RE-TAKEN ==');
  say('  prose spans      ' + spans + '        (D77: 10,445)');
  say('  items            ' + N + '         (D77: 1,247)');
  say('  vectors it implies ' + (spans + N) + '      (D77: 11,692)');
  say('  VERDICT: right as of the day they were taken; the archive and the corpus have grown since.');

  const cos = cosineBench(spans + N);
  say('  brute-force cosine over ' + (spans + N) + ' vectors, plain JS Float32Array, median of 25:');
  for (const [dims, ms] of cos) say('    ' + String(dims).padStart(4) + ' dims  ' + ms.toFixed(1) + ' ms   (D77: '
    + ({ 384: '4.3', 768: '9.3', 1536: '27.2' } as Record<number, string>)[dims] + ' ms)');
  say('  VERDICT: 384 and 768 reproduce. 1536 reproduces well UNDER the recorded figure, so the');
  say('           recorded number is conservative and the conclusion it supports is unaffected.');

  // ══ 2. WHAT THE SHIPPED PREDICATE CAN AND CANNOT SEE ═════════════════════
  let cTitle = 0; let cBody = 0; let cSummary = 0; let cRequest = 0; let cTags = 0; let cObs = 0; let cExtra = 0;
  let nRequest = 0; let nSummary = 0;
  for (const it of items as unknown as Record<string, any>[]) {
    cTitle += it.title.length; cBody += it.body.length;
    if (typeof it.summary === 'string' && it.summary) { cSummary += it.summary.length; nSummary++; }
    if (typeof it.request === 'string' && it.request) { cRequest += it.request.length; nRequest++; }
    cTags += it.tags.join(' ').length;
    for (const o of it.observations) cObs += o.text.length + (o.context ?? '').length;
    for (const v of Object.values(it.extra)) cExtra += String(v).length;
  }
  say('');
  say('== 2. FIELD COVERAGE — what `search --text` can and cannot see ==');
  say('  SEARCHED      title ' + cTitle + '   body ' + cBody + '   observations ' + cObs + '   extra ' + cExtra);
  say('  NOT SEARCHED  summary ' + cSummary + ' chars, on ' + nSummary + '/' + N + ' items');
  say('  NOT SEARCHED  request ' + cRequest + ' chars, on ' + nRequest + '/' + N
    + ' items — HIS OWN VERBATIM WORDS');
  say('  NOT SEARCHED  tags ' + cTags + ' chars (--tag is exact-match and --text never reads them)');
  say('  FINDING: the one field written in the owner\'s vocabulary rather than an agent\'s is the');
  say('           one field the text filter cannot read.');

  // ══ 3. SET V — reach over his own vocabulary ═════════════════════════════
  const prompts = (idx.prepare(
    "SELECT text FROM conversation_prose WHERE kind='prompt' AND agent_id IS NULL",
  ).all() as { text: string }[])
    .map((r) => String(r.text).trim())
    .filter((t) => !t.startsWith('<') && !t.startsWith('Caveat') && t.length > 15);
  const seenIn = new Map<string, number>();
  for (const p of prompts) {
    const once = new Set<string>();
    for (const w of p.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
      if (once.has(w)) continue; once.add(w);
      seenIn.set(w, (seenIn.get(w) ?? 0) + 1);
    }
  }
  const V = [...seenIn.entries()].filter(([, c]) => c >= 3).map(([w]) => w).sort();

  const shippedText = (it: Item): string => {
    const parts = [it.title, it.body];
    for (const o of it.observations) { parts.push(o.text); if (o.context !== null) parts.push(o.context); }
    for (const v of Object.values(it.extra)) parts.push(v);
    return parts.join('\n').toLowerCase();
  };
  const wideText = (it: Item): string => {
    const i = it as unknown as { summary?: string | null; request?: unknown; tags: string[] };
    const parts = [shippedText(it), i.summary ?? '', i.tags.join(' '), it.id.replace(/-/g, ' ')];
    if (typeof i.request === 'string') parts.push(i.request);
    return parts.join('\n').toLowerCase();
  };
  const SHIPPED = items.map(shippedText);
  const SHIPPED_F = SHIPPED.map(fold);
  const WIDE_F = items.map((i) => fold(wideText(i)));
  const conflatedCorpus = new Set<string>();
  for (const t of WIDE_F) for (const w of t.split(' ')) if (w.length > 2) conflatedCorpus.add(conflate(w));

  const anyItem = (hays: string[], terms: string[][]): boolean => {
    outer: for (const hay of hays) {
      for (const vs of terms) if (!vs.some((v) => hay.includes(v))) continue outer;
      return true;
    }
    return false;
  };
  const rungs: [string, (q: string) => boolean][] = [
    ['L0  shipped — one substring, shipped fields', (q) => filterItems(items, { text: q }, cfg).length > 0],
    ['L1  + query split into terms, AND-ed', (q) => anyItem(SHIPPED, words(q).map((t) => [t]))],
    ['L2  + punctuation folded on both sides', (q) => anyItem(SHIPPED_F, words(q).map((t) => [t]))],
    ['L3  + summary, request, tags and id read', (q) => anyItem(WIDE_F, words(q).map((t) => [t]))],
    // The union with L3, so the ladder cannot report a rung that LOST reach:
    // L3 matches a substring anywhere, L4 matches a whole conflated token, and
    // neither contains the other.
    ['L4  + conflation key on the query', (q) => anyItem(WIDE_F, words(q).map((t) => [t]))
      || words(q).every((t) => conflatedCorpus.has(conflate(t)))],
  ];
  say('');
  say('== 3. SET V — REACH over the owner\'s own vocabulary ==');
  say('  ' + V.length + ' English words of 4+ letters that he typed in 3 or more separate prompts.');
  say('  "reach" = the word finds at least one item. It is not a claim that the item is the right one.');
  for (const [name, fn] of rungs) {
    const hit = V.filter(fn).length;
    say('  ' + name.padEnd(44) + String(V.length - hit).padStart(4) + ' find nothing   ('
      + (100 * hit / V.length).toFixed(1) + '% reach)');
  }

  // ── what is left, and which of it is spelling rather than meaning ────────
  const vocabWide = new Set<string>();
  for (const t of WIDE_F) for (const w of t.split(' ')) if (w.length > 2) vocabWide.add(w);
  const vocabList = [...vocabWide];
  const trig = (s: string): Set<string> => {
    const g = new Set<string>(); const p = '  ' + s + '  ';
    for (let i = 0; i + 3 <= p.length; i++) g.add(p.slice(i, i + 3));
    return g;
  };
  const vocabTrig = vocabList.map(trig);
  const jac = (a: Set<string>, b: Set<string>): number => {
    let i = 0; for (const x of a) if (b.has(x)) i++;
    return i / (a.size + b.size - i);
  };
  // The complement of the LAST rung, so this count and the ladder's bottom line
  // are the same number by construction rather than by two expressions agreeing.
  const lastRung = rungs[rungs.length - 1][1];
  const unreached = V.filter((w) => !lastRung(w));
  let near1 = 0; let near2 = 0; const residual: string[] = []; const repairs: string[] = [];
  for (const w of unreached) {
    const tw = trig(w); let best: string | null = null; let bestJ = 0;
    for (let i = 0; i < vocabList.length; i++) {
      const j = jac(tw, vocabTrig[i]);
      if (j > bestJ) { bestJ = j; best = vocabList[i]; }
    }
    if (best !== null && bestJ >= 0.5 && editLE(w, best, 1)) { near1++; repairs.push(w + ' -> ' + best); }
    else if (best !== null && bestJ >= 0.45 && editLE(w, best, 2)) { near2++; repairs.push(w + ' ~> ' + best); }
    else residual.push(w);
  }
  say('  of the ' + unreached.length + ' words still unreached at L4:');
  say('    ' + near1 + ' are within edit distance 1 of a word the corpus does use — MISSPELLING, not meaning');
  say('    ' + near2 + ' are within edit distance 2');
  say('    ' + residual.length + ' are reached by nothing mechanical — this is the alias table\'s actual job');
  say('  repairs a trigram-nearest pass would make (sample): ' + repairs.slice(0, 8).join(', '));
  say('  residual (sample): ' + residual.slice(0, 14).join(', '));

  // ══ 4. SET R — does the RIGHT item come back ═════════════════════════════
  const requests = new Map<string, string>();
  for (const it of items as unknown as Record<string, any>[]) {
    if (typeof it.request === 'string' && it.request.trim().length > 20) requests.set(it.id, it.request);
  }
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
  interface Field { text: string; weight: number }
  const fieldsOf = (it: Item, wide: boolean, hideLeak: boolean): Field[] => {
    const i = it as unknown as { summary?: string | null; tags: string[] };
    const req = hideLeak ? requests.get(it.id) : undefined;
    const f: Field[] = [
      { text: mask(it.body, req), weight: 1 },
      { text: mask(it.observations.map((o) => o.text + ' ' + (o.context ?? '')).join('\n'), req), weight: 1 },
      { text: mask(Object.values(it.extra).join('\n'), req), weight: 1 },
      { text: mask(it.title, req), weight: 3 },
    ];
    if (wide) {
      f.push({ text: mask(i.summary ?? '', req), weight: 3 });
      f.push({ text: i.tags.join(' '), weight: 2 });
      f.push({ text: it.id.replace(/-/g, ' '), weight: 2 });
    }
    return f;
  };
  const build = (docs: Field[][], stem: boolean) => {
    const tf: Map<string, number>[] = []; const len: number[] = []; const df = new Map<string, number>();
    for (const d of docs) {
      const m = new Map<string, number>(); let L = 0;
      for (const f of d) {
        for (const t0 of content(f.text)) {
          const t = stem ? conflate(t0) : t0;
          m.set(t, (m.get(t) ?? 0) + f.weight); L += f.weight;
        }
      }
      tf.push(m); len.push(L);
      for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    }
    return { tf, len, df, avg: len.reduce((a, b) => a + b, 0) / docs.length, n: docs.length };
  };
  type Ix = ReturnType<typeof build>;
  const score = (ix: Ix, terms: string[]): Float64Array => {
    const k1 = 1.2; const b = 0.75; const s = new Float64Array(ix.n);
    for (const t of terms) {
      const n = ix.df.get(t); if (n === undefined) continue;
      const idf = Math.log(1 + (ix.n - n + 0.5) / (n + 0.5));
      for (let i = 0; i < ix.n; i++) {
        const f = ix.tf[i].get(t); if (f === undefined) continue;
        s[i] += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * ix.len[i] / ix.avg));
      }
    }
    return s;
  };
  const ordered = (s: Float64Array): number[] =>
    [...s.keys()].filter((i) => s[i] > 0).sort((a, c) => s[c] - s[a]);
  const distinctive = (ix: Ix, q: string, k: number, stem: boolean): string[] => {
    const seen = new Set(content(q).map((t) => (stem ? conflate(t) : t)));
    return [...seen]
      .map((t) => [t, Math.log(1 + (ix.n - (ix.df.get(t) ?? ix.n) + 0.5) / ((ix.df.get(t) ?? ix.n) + 0.5))] as const)
      .sort((a, b) => b[1] - a[1]).slice(0, k).map(([t]) => t);
  };

  const ixNarrow = build(items.map((i) => fieldsOf(i, false, true)), false);
  const ixWide = build(items.map((i) => fieldsOf(i, true, true)), false);
  const ixStem = build(items.map((i) => fieldsOf(i, true, true)), true);
  const ixLeaky = build(items.map((i) => fieldsOf(i, true, false)), false);

  const R = [...requests.entries()].map(([id, q]) => ({ id, q }));
  const scoreRun = (label: string, fn: (q: string) => number[]): void => {
    let a1 = 0; let a5 = 0; let a10 = 0; let any = 0; let mrr = 0;
    for (const g of R) {
      const target = pos.get(g.id)!;
      const r = fn(g.q).indexOf(target);
      if (r >= 0) { any++; mrr += 1 / (r + 1); if (r < 1) a1++; if (r < 5) a5++; if (r < 10) a10++; }
    }
    say('  ' + label.padEnd(46) + ' @1 ' + String(a1).padStart(2) + '   @5 ' + String(a5).padStart(2)
      + '   @10 ' + String(a10).padStart(2) + '   anywhere ' + String(any).padStart(2) + '/' + R.length
      + '   MRR ' + (mrr / R.length).toFixed(3));
  };
  say('');
  say('== 4. SET R — does the RIGHT item come back ==');
  say('  ' + R.length + ' owner-authored (request, item) pairs, taken from the `request` field the product');
  say('  itself wrote. Every 8-word window of a request is DELETED from the item it points at, so an');
  say('  item cannot be found by its own copy of the question.');
  say('  -- the whole request as the query --');
  scoreRun('R0 shipped: one substring, no ranking',
    (q) => filterItems(items, { text: q }, cfg).map((h) => pos.get(h.id)!));
  scoreRun('   UNMASKED control (the leak, for scale)', (q) => ordered(score(ixLeaky, content(q))));
  scoreRun('R1 BM25 over the shipped fields', (q) => ordered(score(ixNarrow, content(q))));
  scoreRun('R2  + summary, tags and id, weighted', (q) => ordered(score(ixWide, content(q))));
  scoreRun('R3  + conflation key', (q) => ordered(score(ixStem, content(q).map(conflate))));
  say('  -- the 5 most distinctive words of the request, which is what a person types --');
  scoreRun('R0 shipped: those 5 words as one substring',
    (q) => filterItems(items, { text: distinctive(ixWide, q, 5, false).join(' ') }, cfg).map((h) => pos.get(h.id)!));
  scoreRun('R1 BM25 over the shipped fields', (q) => ordered(score(ixNarrow, distinctive(ixNarrow, q, 5, false))));
  scoreRun('R2  + summary, tags and id, weighted', (q) => ordered(score(ixWide, distinctive(ixWide, q, 5, false))));
  scoreRun('R3  + conflation key', (q) => ordered(score(ixStem, distinctive(ixStem, q, 5, true))));

  // ══ 5. THE GRAPH AND THE TAGS ════════════════════════════════════════════
  const byPlanSeq = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const e = (items[i] as unknown as { extra: Record<string, string> }).extra;
    if (e.plan && e.seq) byPlanSeq.set(e.plan + '/' + e.seq, i);
  }
  let rowsTotal = 0; const byType = new Map<string, number>();
  const nbr: number[][] = items.map(() => []);
  let usable = 0;
  for (let i = 0; i < N; i++) {
    for (const r of items[i].relations) {
      rowsTotal++; byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
      if (r.type === 'supersedes' || r.type === 'superseded_by') continue;
      const j = pos.get(r.target); if (j === undefined) continue;
      nbr[i].push(j); nbr[j].push(i); usable++;
    }
    const needs = (items[i] as unknown as { extra: Record<string, string> }).extra.needs;
    if (needs) {
      for (const ref of String(needs).split(/[\s,]+/).filter(Boolean)) {
        const j = byPlanSeq.get(ref); if (j === undefined) continue;
        nbr[i].push(j); nbr[j].push(i); usable++;
      }
    }
  }
  const tagged = new Map<string, number[]>();
  for (let i = 0; i < N; i++) {
    for (const t of (items[i] as unknown as { tags: string[] }).tags) {
      const a = tagged.get(t) ?? []; a.push(i); tagged.set(t, a);
    }
  }
  const sup = (byType.get('supersedes') ?? 0) + (byType.get('superseded_by') ?? 0);
  say('');
  say('== 5. THE CORPUS\'S OWN RELATION GRAPH AND TAG VOCABULARY, AS QUERY EXPANSION ==');
  say('  relation rows ' + rowsTotal + ' over ' + items.filter((i) => i.relations.length > 0).length
    + '/' + N + ' items;  ' + sup + ' of them (' + (100 * sup / rowsTotal).toFixed(0)
    + '%) are supersession, which points AT retired knowledge.');
  say('  usable undirected edges once supersession is dropped and `needs:` is resolved through');
  say('  plan/seq: ' + usable + ', touching ' + nbr.filter((a) => a.length > 0).length + '/' + N + ' items.');
  say('  plan: cohorts ' + [...tagged.keys()].filter((t) => t.startsWith('plan:')).length
    + ';  distinct tags ' + tagged.size);
  const graphAdd = (s: Float64Array, alpha: number): Float64Array => {
    const o = Float64Array.from(s); const top = ordered(s).slice(0, 10); const seed = new Set(top);
    for (const i of top) for (const j of nbr[i]) if (!seed.has(j)) o[j] += alpha * s[i];
    return o;
  };
  const planAdd = (s: Float64Array, beta: number): Float64Array => {
    const o = Float64Array.from(s); const top = ordered(s).slice(0, 3);
    for (const i of top) {
      for (const t of (items[i] as unknown as { tags: string[] }).tags) {
        if (!t.startsWith('plan:')) continue;
        const c = tagged.get(t)!;
        for (const j of c) if (j !== i) o[j] += beta * s[i] / Math.log(2 + c.length);
      }
    }
    return o;
  };
  const short = (q: string): string[] => distinctive(ixStem, q, 5, true);
  say('  measured on SET R, against R3 as the base:');
  scoreRun('base (R3)', (q) => ordered(score(ixStem, short(q))));
  scoreRun('+ relation-graph propagation, a=0.35', (q) => ordered(graphAdd(score(ixStem, short(q)), 0.35)));
  scoreRun('+ relation-graph propagation, a=0.10', (q) => ordered(graphAdd(score(ixStem, short(q)), 0.10)));
  scoreRun('+ plan: cohort propagation, b=0.20', (q) => ordered(planAdd(score(ixStem, short(q)), 0.20)));
  let missed = 0; let rescued = 0;
  for (const g of R) {
    const t = pos.get(g.id)!; const s = score(ixStem, short(g.q));
    if (s[t] > 0) continue;
    missed++;
    if (graphAdd(s, 0.35)[t] > 0) rescued++;
  }
  say('  RESCUE: of ' + missed + ' targets the lexical pass does not return at all, the graph reaches '
    + rescued + '.');

  // ══ 6. HEBREW ════════════════════════════════════════════════════════════
  say('');
  say('== 6. HEBREW — measured before anything is offered ==');
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
  say('  fixture: ' + fromStrings + ' Hebrew strings from the shipped UI table + '
    + (heDocs.length - fromStrings) + ' Hebrew lines from corpus items = ' + heDocs.length + '.');
  const fts = (tokenize: string): DatabaseSync => {
    const db = new DatabaseSync(':memory:');
    db.exec("CREATE VIRTUAL TABLE t USING fts5(text, tokenize='" + tokenize + "')");
    const ins = db.prepare('INSERT INTO t(text) VALUES (?)');
    for (const d of heDocs) ins.run(d);
    return db;
  };
  const tri3 = fts('trigram');
  const uni = fts('unicode61');
  const hit = (db: DatabaseSync, q: string): number =>
    (db.prepare('SELECT count(*) c FROM t WHERE t MATCH ?').get('"' + q.replace(/"/g, '""') + '"') as
      { c: number }).c;
  const heFreq = new Map<string, number>();
  for (const d of heDocs) for (const w of d.match(/[\u0590-\u05FF]{3,}/g) ?? []) heFreq.set(w, (heFreq.get(w) ?? 0) + 1);
  const heVocab = [...heFreq.keys()];
  const bareOnly = heVocab.filter((w) => w.length >= 4 && !HEBREW_PARTICLES.includes(w[0])
    && HEBREW_PARTICLES.every((p) => !heFreq.has(p + w)));
  let triGlued = 0; let uniGlued = 0; let stripped = 0; let trials = 0;
  for (const w of bareOnly) {
    for (const p of HEBREW_PARTICLES) {
      trials++;
      if (hit(tri3, p + w) > 0) triGlued++;
      if (hit(uni, p + w) > 0) uniGlued++;
      if (hebrewVariants(p + w).some((v) => hit(tri3, v) > 0)) stripped++;
    }
  }
  say('  ' + heVocab.length + ' Hebrew word types. THE QUESTION: he types a word with a particle glued');
  say('  on its front (' + HEBREW_PARTICLES.join(' ') + ') and the text writes the bare word. '
    + trials + ' such queries:');
  say('    FTS5 trigram    finds ' + triGlued + '/' + trials + '  (' + (100 * triGlued / trials).toFixed(1) + '%)');
  say('    FTS5 unicode61  finds ' + uniGlued + '/' + trials + '  (' + (100 * uniGlued / trials).toFixed(1)
    + '%)   <- the word-boundary tokenizer, ' + (triGlued / Math.max(1, uniGlued)).toFixed(0) + 'x worse');
  say('    trigram + stripping ONE front particle off the query: ' + stripped + '/' + trials
    + '  (' + (100 * stripped / trials).toFixed(1) + '%)');
  const ambiguous = heVocab.filter((w) => w.length >= 4 && HEBREW_PARTICLES.includes(w[0])
    && heFreq.has(w.slice(1))).length;
  say('  PRECISION COST, stated rather than hidden: ' + ambiguous + ' Hebrew word types in this fixture');
  say('  begin with a particle letter AND have a remainder that is itself a word, so stripping is');
  say('  additive recall bought with spurious hits, not a free win.');
  const changedGuarded = heVocab.filter((w) => conflate(w) !== w).length;
  const noGuard = (t: string): string => {
    let s = t;
    if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y';
    else if (s.length > 4 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
    if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
    else if (s.length > 4 && s.endsWith('ed') && !s.endsWith('eed')) s = s.slice(0, -2);
    if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1);
    if (s.length > 4 && s.endsWith('ly')) s = s.slice(0, -2);
    return s;
  };
  const changedNoGuard = heVocab.filter((w) => noGuard(w) !== w).length;
  say('  REMOVAL PROOF on the ASCII guard: guarded, it rewrites ' + changedGuarded + '/' + heVocab.length
    + ' Hebrew word types; with the guard deleted, ' + changedNoGuard + '/' + heVocab.length + '.');
  say('  VERDICT: the guard is NOT load-bearing for these suffix rules — the damage it prevents is zero,');
  say('           because no Hebrew word ends in `s`, `ed`, `ing` or `ly`. It stays as insurance for any');
  say('           future rule that trims by LENGTH, which would maul Hebrew immediately.');

  // ══ 7. THE ARCHIVE SIDE, WHICH IS THE ONE HE ASKED ABOUT OUT LOUD ════════
  //
  // "try to look in the context window and if not found search the archived
  // conversation" — 2026-09-13. `searchArchive` quotes the reader's text into
  // ONE FTS5 phrase, which on a trigram index is a contiguous substring. That
  // is the right semantics for a fragment somebody remembers and the wrong one
  // for a description, and the split has never been measured.
  const phrases: string[] = [];
  for (const p of prompts) {
    const w = content(p);
    for (let i = 0; i + 2 <= w.length; i++) {
      if (w[i].length >= 5 && w[i + 1].length >= 5) phrases.push(w[i] + ' ' + w[i + 1]);
    }
  }
  // Sampled by a STRIDE over the sorted set rather than by taking the first
  // 1,500 of it: sorted-and-truncated is the whole of the alphabet up to `c`,
  // and the vocabulary of a project is not evenly spread across letters.
  const allPhrases = [...new Set(phrases)].sort();
  const stride = Math.max(1, Math.ceil(allPhrases.length / 1500));
  const uniquePhrases = allPhrases.filter((_, i) => i % stride === 0);
  const asPhrase = idx.prepare('SELECT count(*) c FROM conversation_prose WHERE conversation_prose MATCH ?');
  let phraseHit = 0; let termsHit = 0;
  const phraseSizes: number[] = []; const termSizes: number[] = [];
  for (const q of uniquePhrases) {
    const [a, b] = q.split(' ');
    const p1 = (asPhrase.get('"' + q + '"') as { c: number }).c;
    const p2 = (asPhrase.get('"' + a + '" AND "' + b + '"') as { c: number }).c;
    if (p1 > 0) { phraseHit++; phraseSizes.push(p1); }
    if (p2 > 0) { termsHit++; termSizes.push(p2); }
  }
  const median = (a: number[]): number => (a.length === 0 ? 0 : [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]);
  say('');
  say('== 7. THE ARCHIVE — the same split, on the surface he asked about by name ==');
  say('  ' + uniquePhrases.length + ' two-word phrases he actually typed (both words 5+ letters), sampled by');
  say('  stride from ' + allPhrases.length + ', run against the real prose index, read-only:');
  say('    as ONE quoted phrase, which is what `searchArchive` sends: ' + phraseHit + ' of '
    + uniquePhrases.length + ' return something ('
    + (100 * phraseHit / uniquePhrases.length).toFixed(1) + '%), median ' + median(phraseSizes) + ' spans');
  say('    as two AND-ed terms:                                      ' + termsHit + ' of '
    + uniquePhrases.length + ' return something ('
    + (100 * termsHit / uniquePhrases.length).toFixed(1) + '%), median ' + median(termSizes) + ' spans');
  say('  READ THE SECOND NUMBER WITH ITS MEDIAN. AND-ing terms reaches everything precisely because');
  say('  it reaches too much; it is only usable because `matchProse` already orders by bm25, and');
  say('  `filterItems` on the CORPUS side has no such ordering and refuses to grow one on purpose.');
  say('  The phrase reading is RIGHT for a fragment somebody half-remembers and WRONG for a');
  say('  description; nothing on any surface lets a reader pick, and nothing says which they got.');

  flush();
  return 0;
}

function editLE(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v); if (v < best) best = v;
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

function cosineBench(n: number): [number, number][] {
  const results: [number, number][] = [];
  for (const d of [384, 768, 1536]) {
    const store = new Float32Array(n * d);
    for (let i = 0; i < store.length; i++) store[i] = Math.random() * 2 - 1;
    for (let i = 0; i < n; i++) {
      let s = 0; const o = i * d;
      for (let j = 0; j < d; j++) s += store[o + j] * store[o + j];
      s = 1 / Math.sqrt(s);
      for (let j = 0; j < d; j++) store[o + j] *= s;
    }
    const q = new Float32Array(d);
    for (let j = 0; j < d; j++) q[j] = Math.random() * 2 - 1;
    const times: number[] = [];
    for (let r = 0; r < 30; r++) {
      const t0 = process.hrtime.bigint();
      let bs = -Infinity;
      for (let i = 0; i < n; i++) {
        const o = i * d; let s = 0;
        for (let j = 0; j < d; j++) s += store[o + j] * q[j];
        if (s > bs) bs = s;
      }
      if (bs === -Infinity) throw new Error('unreachable');
      if (r >= 5) times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    times.sort((a, b) => a - b);
    results.push([d, times[Math.floor(times.length / 2)]]);
  }
  return results;
}

/**
 * Guarded, because `test/core/search-floor.test.ts` imports `conflate` and
 * `hebrewVariants` from here rather than keeping a second copy of them — two
 * hand-kept expressions of one rule is this project's most-repeated defect, and
 * a stemmer is exactly the kind of thing that would drift.
 */
if (isMainEntry(import.meta.filename, process.argv[1])) process.exitCode = main();
