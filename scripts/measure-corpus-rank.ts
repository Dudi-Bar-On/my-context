#!/usr/bin/env node
/**
 * **Does the ranker that SHIPPED return the right item** —
 * `TASK-the-corpus-box-refuses-to-rank-so-it-returns-the-right-item`
 * (`semantic/7`), measured against the ground truth that made the case for
 * building it.
 *
 *     node scripts/measure-corpus-rank.ts
 *
 * It READS. It opens the corpus read-only through `loadLayer`, builds masked
 * copies of the items in memory, and writes nothing anywhere.
 *
 * ── WHY THIS IS A SECOND SCRIPT AND NOT A RUNG IN THE FIRST ────────────────
 *
 * `scripts/measure-search-floor.ts` is the measurement that made the CASE. Its
 * BM25 is hand-written INSIDE it, deliberately, because a measurement may not
 * depend on the thing it is measuring — at the time there was nothing to depend
 * on. Its rungs stay exactly as they are, as the record.
 *
 * This one measures the OPPOSITE thing: it imports `searchItems` from
 * `src/core/rank.ts` and scores THE CODE THAT RUNS. The two now sit side by
 * side over one corpus and one ground truth, and if the shipped ranker ever
 * stops reproducing the floor script's numbers they disagree out loud.
 *
 * ── THE GROUND TRUTH, UNCHANGED AND NOT RE-DERIVED ─────────────────────────
 *
 * SET R is `semantic/1`'s: every item carrying the owner's VERBATIM `request`,
 * paired with the item that request produced. The product wrote both sides;
 * nobody labelled it for this run. It was 42 pairs when the case was made and
 * the corpus has grown since, so the denominator printed below is whatever the
 * corpus holds TODAY and the historical 42 is named beside it.
 *
 * **THE LEAK IS MASKED.** Nineteen of the original forty-two quote the request
 * back inside their own body. Every eight-word window of an item's request is
 * deleted from that item's title, body, summary, observations and `extra`
 * before scoring, and the unmasked control is printed beside the masked run so
 * the size of the leak stays visible rather than described.
 *
 * **THE BASELINE IS MASKED TOO, and that is a correction.** The floor script
 * scores its `R0` rung against the UNMASKED corpus (`filterItems(items, …)`,
 * where `items` is the raw load) while every ranked rung is scored against
 * masked fields. That flatters the baseline: its 3/44 on the whole request is
 * three items found by their own copy of the question. Both are printed here.
 *
 * **`request` IS NOT INDEXED, and that is why this measurement is possible at
 * all.** `rankFields` (src/core/rank.ts) deliberately leaves it out; indexing
 * the field the queries are DRAWN FROM would score the fixture.
 *
 * ── AND THE NOISE BAND IS PRINTED BEFORE ANY COMPARISON IS DRAWN ───────────
 *
 * Forty-four queries is a small set and `@1` is a count over it. Section 5
 * bootstraps the metric over its own queries so that nobody — this lane
 * included — reads a two-item difference as a result.
 */
import {
  buildIndex, content, conflate, FIELD_WEIGHTS, type RankField, type RankIndex,
  scoreAll, searchItems,
} from '../src/core/rank.ts';
import { filterItems } from '../src/core/search.ts';
import { loadLayer, type LoadError } from '../src/core/rebuild.ts';
import type { Item } from '../src/core/types.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';

const out: string[] = [];
const say = (s = ''): void => { out.push(s); };
const flush = (): void => { process.stdout.write(out.join('\n') + '\n'); };

const words = (s: string): string[] =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter((t) => t.length > 0);

/** Every 8-word window of `req`, deleted from `text`. The floor script's mask. */
function mask(text: string, req: string | undefined): string {
  if (req === undefined) return text;
  const rw = words(req);
  const win = new Set<string>();
  for (let i = 0; i + 8 <= rw.length; i++) win.add(rw.slice(i, i + 8).join(' '));
  if (win.size === 0) return text;
  const tw = words(text);
  const drop = new Uint8Array(tw.length);
  for (let i = 0; i + 8 <= tw.length; i++) {
    if (win.has(tw.slice(i, i + 8).join(' '))) for (let j = i; j < i + 8; j++) drop[j] = 1;
  }
  return tw.filter((_, i) => drop[i] === 0).join(' ');
}

/** The item with its own request's windows deleted from every ranked field. */
function masked(item: Item, req: string | undefined): Item {
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(item.extra)) extra[k] = mask(v, req);
  return {
    ...item,
    title: mask(item.title, req),
    body: mask(item.body, req),
    summary: item.summary === null ? null : mask(item.summary, req),
    observations: item.observations.map((o) => ({
      ...o, text: mask(o.text, req), context: o.context === null ? null : mask(o.context, req),
    })),
    extra,
  };
}

const obsText = (i: Item): string => i.observations
  .map((o) => o.text + (o.context === null ? '' : ' ' + o.context)).join('\n');

function main(): number {
  const ws = resolveWorkspace(process.cwd());
  if (ws.projectRoot === null) {
    say('my_context: no workspace here — nothing was measured, which is not the same as nothing '
      + 'being wrong. Run this from the repository root.');
    flush();
    return 1;
  }
  const errors: LoadError[] = [];
  const raw = loadLayer(ws.projectRoot, 'project', errors, ws.config) as Item[];
  if (raw.length === 0) {
    say('my_context: no items — nothing was measured.');
    flush();
    return 1;
  }
  const cfg = ws.config;

  const requests = new Map<string, string>();
  for (const it of raw as unknown as Record<string, string>[]) {
    if (typeof it.request === 'string' && it.request.trim().length > 20) {
      requests.set(it.id, it.request);
    }
  }
  const items = raw.map((it) => masked(it, requests.get(it.id)));
  const R = [...requests.entries()].map(([id, q]) => ({ id, q }));

  say('== SET R, ON TODAY\'S CORPUS ==');
  say('  items ' + items.length + ';  owner-authored (request, item) pairs ' + R.length
    + '   (the case was made on 42 — `semantic/1`, 2026-09-15)');
  say('  Every 8-word window of a request is DELETED from the item it points at, in title,');
  say('  body, summary, observations and extra. `request` itself is never indexed, by either');
  say('  the ranker or this script — the queries are drawn FROM it.');

  const shippedIndex = buildIndex(items);
  const idfIn = (ix: RankIndex) => (t: string): number => {
    const n = ix.df.get(t) ?? ix.n;
    return Math.log(1 + (ix.n - n + 0.5) / (n + 0.5));
  };

  /**
   * **The query a person is simulated as typing.** `semantic/1` fixed this
   * protocol and it is reproduced rather than reinvented: the five most
   * distinctive content words of the request, by idf.
   *
   * It comes in TWO spellings and the floor script uses both without naming the
   * difference, which is why its `R2` and `R3` rungs are not comparable to each
   * other. `surface` dedupes by the word as typed (R1/R2's protocol); `key`
   * dedupes by conflation key, so `search` and `searches` cannot both spend a
   * slot (R3's protocol, and the rung the number 15 comes from). Both are run.
   */
  const distinctive = (ix: RankIndex, q: string, k: number, dedup: 'surface' | 'key'): string => {
    const idf = idfIn(ix);
    const first = new Map<string, string>();
    for (const t of content(q)) {
      const key = dedup === 'key' ? conflate(t) : t;
      if (!first.has(key)) first.set(key, t);
    }
    return [...first.values()]
      .map((t) => [t, idf(t)] as const)
      .sort((a, b) => b[1] - a[1]).slice(0, k).map(([t]) => t).join(' ');
  };

  interface Row { a1: number; ranks: number[] }
  const run = (label: string, fn: (q: string) => string[]): Row => {
    let a1 = 0; let a5 = 0; let a10 = 0; let any = 0; let mrr = 0;
    const ranks: number[] = [];
    const t0 = performance.now();
    for (const g of R) {
      const r = fn(g.q).indexOf(g.id);
      ranks.push(r);
      if (r >= 0) { any++; mrr += 1 / (r + 1); if (r < 1) a1++; if (r < 5) a5++; if (r < 10) a10++; }
    }
    const ms = (performance.now() - t0) / R.length;
    say('  ' + label.padEnd(48) + ' @1 ' + String(a1).padStart(2) + '   @5 ' + String(a5).padStart(2)
      + '   @10 ' + String(a10).padStart(2) + '   anywhere ' + String(any).padStart(2) + '/' + R.length
      + '   MRR ' + (mrr / R.length).toFixed(3) + '   ' + ms.toFixed(0) + ' ms/q');
    return { a1, ranks };
  };

  const before = (pool: Item[]) => (q: string): string[] =>
    filterItems(pool, { text: q }, cfg).map((i) => i.id);
  const after = (pool: Item[]) => (q: string): string[] =>
    searchItems(pool, { text: q }, cfg).items.map((i) => i.id);

  say('');
  say('== 1. THE WHOLE REQUEST AS THE QUERY ==');
  run('BEFORE filterItems, masked corpus', before(items));
  run('BEFORE filterItems, UNMASKED (floor script\'s R0)', before(raw));
  const wholeAfter = run('AFTER  searchItems, ranked', after(items));
  run('       UNMASKED control (the leak, for scale)', after(raw));

  say('');
  say('== 2. THE FIVE MOST DISTINCTIVE WORDS — the protocol the case was made on ==');
  say('  2a. dedup by SURFACE form — the floor script\'s R1/R2 protocol (its best: @1 11, any 38)');
  const five = (dedup: 'surface' | 'key', fn: (q: string) => string[]) => (q: string): string[] =>
    fn(distinctive(shippedIndex, q, 5, dedup));
  run('BEFORE filterItems: those 5 as one substring', five('surface', before(items)));
  const pruned = run('AFTER  searchItems, ranked', five('surface', after(items)));
  say('  2b. dedup by CONFLATION KEY — the floor script\'s R3 protocol, where 15 comes from');
  run('BEFORE filterItems: those 5 as one substring', five('key', before(items)));
  run('AFTER  searchItems, ranked', five('key', after(items)));

  // ══ 3. WHICH HALF EARNED IT ═══════════════════════════════════════════════
  //
  // Coverage and weighting are different claims and neither may borrow the
  // other's number. Every row below runs through the SHIPPED scorer via
  // `buildIndex`'s `fieldsOf` hook, so the BM25 under all of them is one
  // implementation and only the field set differs.
  const F = {
    title: (i: Item, w: number) => ({ text: i.title, weight: w }),
    summary: (i: Item, w: number) => ({ text: i.summary ?? '', weight: w }),
    tags: (i: Item, w: number) => ({ text: i.tags.join(' '), weight: w }),
    id: (i: Item, w: number) => ({ text: i.id.replace(/-/g, ' '), weight: w }),
    body: (i: Item, w: number) => ({ text: i.body, weight: w }),
    obs: (i: Item, w: number) => ({ text: obsText(i), weight: w }),
    extra: (i: Item, w: number) => ({ text: Object.values(i.extra).join('\n'), weight: w }),
  };
  const sets: [string, (i: Item) => RankField[]][] = [
    ['shipped — all seven fields', (i) => [F.title(i, 3), F.summary(i, 3), F.tags(i, 2),
      F.id(i, 2), F.body(i, 1), F.obs(i, 1), F.extra(i, 1)]],
    ['FLAT — every field worth 1', (i) => [F.title(i, 1), F.summary(i, 1), F.tags(i, 1),
      F.id(i, 1), F.body(i, 1), F.obs(i, 1), F.extra(i, 1)]],
    ['REVERSED — body 3, title and summary 1', (i) => [F.title(i, 1), F.summary(i, 1),
      F.tags(i, 1), F.id(i, 1), F.body(i, 3), F.obs(i, 3), F.extra(i, 3)]],
    ['minus summary', (i) => [F.title(i, 3), F.tags(i, 2), F.id(i, 2), F.body(i, 1),
      F.obs(i, 1), F.extra(i, 1)]],
    ['minus tags', (i) => [F.title(i, 3), F.summary(i, 3), F.id(i, 2), F.body(i, 1),
      F.obs(i, 1), F.extra(i, 1)]],
    ['minus id', (i) => [F.title(i, 3), F.summary(i, 3), F.tags(i, 2), F.body(i, 1),
      F.obs(i, 1), F.extra(i, 1)]],
    ['minus body — title, summary, tags, id only', (i) => [F.title(i, 3), F.summary(i, 3),
      F.tags(i, 2), F.id(i, 2), F.obs(i, 1), F.extra(i, 1)]],
    ['SHIPPED FIELDS ONLY — what --text could read', (i) => [F.title(i, 3), F.body(i, 1),
      F.obs(i, 1), F.extra(i, 1)]],
  ];
  const groupsOf = (q: string): string[][] =>
    [...new Set(content(q))].map((t) => [...new Set([t, conflate(t)])]);
  const orderOf = (s: Float64Array): string[] =>
    [...s.keys()].filter((i) => s[i] > 0)
      .sort((a, b) => (s[b] - s[a]) || items[a].id.localeCompare(items[b].id))
      .map((i) => items[i].id);
  say('');
  say('== 3. WHICH HALF EARNED IT — one scorer, different field sets ==');
  for (const [label, fieldsOf] of sets) {
    const ix = buildIndex(items, fieldsOf);
    say('  -- ' + label);
    run('     pruned to 5 (surface dedup)',
      (q) => orderOf(scoreAll(ix, groupsOf(distinctive(ix, q, 5, 'surface')))));
    run('     whole request', (q) => orderOf(scoreAll(ix, groupsOf(q))));
  }

  // ══ 4. REFINEMENTS MEASURED AND REFUSED ══════════════════════════════════
  //
  // The scorer below is NOT the shipped one — it is the shipped one plus the
  // knob being tested, written here because none of these knobs ships. Each was
  // proposed on an argument and each is refused on a number.
  const K1 = 1.2;
  const variantScore = (
    ix: RankIndex, groups: string[][], opts: { coord: number; b: number; combine: 'max' | 'sum' },
  ): Float64Array => {
    const s = new Float64Array(ix.n);
    const hit = new Float64Array(ix.n);
    const one = (term: string, doc: number): number => {
      const n = ix.df.get(term); if (n === undefined) return 0;
      const f = ix.tf[doc].get(term); if (f === undefined) return 0;
      const idf = Math.log(1 + (ix.n - n + 0.5) / (n + 0.5));
      return idf * (f * (K1 + 1)) / (f + K1 * (1 - opts.b + opts.b * ix.len[doc] / ix.avg));
    };
    for (const forms of groups) {
      for (let i = 0; i < ix.n; i++) {
        let v = 0;
        for (const form of forms) {
          const x = one(form, i);
          if (opts.combine === 'sum') v += x; else if (x > v) v = x;
        }
        if (v > 0) { s[i] += v; hit[i] += 1; }
      }
    }
    if (opts.coord > 0 && groups.length > 0) {
      for (let i = 0; i < ix.n; i++) s[i] *= Math.pow(hit[i] / groups.length, opts.coord);
    }
    return s;
  };
  say('');
  say('== 4. REFINEMENTS PROPOSED, MEASURED AND REFUSED ==');
  say('  Each is scored on the pruned-to-5 protocol (surface dedup), against the shipped row.');
  for (const [label, opts] of [
    ['shipped: max over forms, b=0.75, no coord', { coord: 0, b: 0.75, combine: 'max' as const }],
    ['+ coordination bonus ^0.25', { coord: 0.25, b: 0.75, combine: 'max' as const }],
    ['+ coordination bonus ^0.50', { coord: 0.5, b: 0.75, combine: 'max' as const }],
    ['+ coordination bonus ^1.00', { coord: 1, b: 0.75, combine: 'max' as const }],
    ['length norm b=0.30', { coord: 0, b: 0.3, combine: 'max' as const }],
    ['length norm b=0.90', { coord: 0, b: 0.9, combine: 'max' as const }],
    ['SUM over forms instead of MAX', { coord: 0, b: 0.75, combine: 'sum' as const }],
  ] as [string, { coord: number; b: number; combine: 'max' | 'sum' }][]) {
    run(label, (q) => orderOf(variantScore(
      shippedIndex, groupsOf(distinctive(shippedIndex, q, 5, 'surface')), opts)));
  }

  // ══ 5. THE NOISE BAND ════════════════════════════════════════════════════
  say('');
  say('== 5. THE NOISE BAND — read before comparing any two rows above ==');
  const boot = (ranks: number[], at: number): string => {
    const samples: number[] = [];
    // Deterministic pseudo-random so two runs of this script agree: a plain
    // LCG, seeded from the set size. A bootstrap that moved between runs would
    // be one more number nobody could reproduce.
    let seed = ranks.length * 2654435761 >>> 0;
    const next = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let b = 0; b < 2000; b++) {
      let c = 0;
      for (let i = 0; i < ranks.length; i++) {
        const r = ranks[Math.floor(next() * ranks.length)];
        if (r >= 0 && r < at) c++;
      }
      samples.push(c);
    }
    samples.sort((a, b) => a - b);
    return '2.5% ' + samples[50] + '   median ' + samples[1000] + '   97.5% ' + samples[1950];
  };
  say('  2,000 bootstrap resamples of the ' + R.length + ' queries, pruned-to-5, shipped ranker:');
  say('    @1  ' + boot(pruned.ranks, 1));
  say('    @5  ' + boot(pruned.ranks, 5));
  say('  and on the whole request:');
  say('    @1  ' + boot(wholeAfter.ranks, 1));
  say('  READ THIS BEFORE THE TABLES: on a set this size an @1 difference of a few items is');
  say('  inside the band. Recall (`anywhere`) and the whole-request rows are where the');
  say('  differences are larger than the noise.');

  // ══ 6. WHAT IT STILL MISSES ══════════════════════════════════════════════
  say('');
  say('== 6. WHAT IT STILL MISSES, NAMED ==');
  const misses: { id: string; rank: number; q: string }[] = [];
  for (let i = 0; i < R.length; i++) {
    if (pruned.ranks[i] === 0) continue;
    misses.push({ id: R[i].id, rank: pruned.ranks[i], q: distinctive(shippedIndex, R[i].q, 5, 'surface') });
  }
  say('  ' + misses.length + ' of ' + R.length + ' are not at rank one under the pruned protocol.');
  for (const m of misses.sort((a, b) => (a.rank < 0 ? 1e9 : a.rank) - (b.rank < 0 ? 1e9 : b.rank))) {
    say('    ' + (m.rank < 0 ? 'NOT RETURNED' : 'rank ' + String(m.rank + 1).padStart(4))
      + '  [' + m.q + ']  -> ' + m.id);
  }

  // ══ 7. THE PRICE OF THE UNION ════════════════════════════════════════════
  say('');
  say('== 7. THE PRICE OF THE UNION — how large the ranked set is ==');
  say('  Ordering is not filtering, so all of these come back and the caller says how many it');
  say('  is not showing. This is the number that makes saying so necessary.');
  const sizes: number[] = [];
  let exacts = 0;
  for (const g of R) {
    const o = searchItems(items, { text: distinctive(shippedIndex, g.q, 5, 'surface') }, cfg);
    sizes.push(o.items.length);
    exacts += o.exact;
  }
  sizes.sort((a, b) => a - b);
  say('  matched-set size over ' + R.length + ' queries: min ' + sizes[0]
    + '   median ' + sizes[Math.floor(sizes.length / 2)] + '   max ' + sizes[sizes.length - 1]
    + '   (corpus ' + items.length + ')');
  say('  of those, matched as ONE contiguous substring — the whole of what shipped: ' + exacts);

  say('');
  say('== 8. COST ==');
  const bench = (label: string, fn: () => unknown): void => {
    fn();
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) fn();
    say('  ' + label.padEnd(52) + ((performance.now() - t0) / 20).toFixed(1) + ' ms');
  };
  bench('searchItems, 6-word query, ' + items.length + ' items',
    () => searchItems(items, { text: 'the corpus box refuses to rank' }, cfg));
  bench('filterItems, same query, same corpus',
    () => filterItems(items, { text: 'the corpus box refuses to rank' }, cfg));
  bench('searchItems, scoped to --type task first',
    () => searchItems(items, { text: 'the corpus box refuses to rank', type: 'task' }, cfg));
  say('  (FTS5 built this corpus into a throwaway index in 535 ms — '
    + 'reports/2026-09-16-the-search-grammar.md §4)');

  say('');
  say('  FIELD_WEIGHTS in force: ' + JSON.stringify(FIELD_WEIGHTS));
  for (const e of errors) say('  LOAD ERROR ' + e.file + ': ' + e.message);
  flush();
  return 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) process.exitCode = main();
