/**
 * **The order over what matched** — `RULE-search-may-rank-its-results-and-semantic-search-is-not`,
 * owner ruling 2026-09-16, and `TASK-the-corpus-box-refuses-to-rank-so-it-returns-the-right-item`.
 *
 * `filterItems` (`search.ts`) refused to rank in its own docblock, on the
 * ground that *"there is no signal in a corpus this size to support one"*.
 * That refusal was measured and is lifted. The measurement it lost to is
 * `scripts/measure-search-floor.ts` and `reports/2026-09-15-the-search-floor.md`:
 * over 42 owner-authored (request, item) pairs, the shipped predicate given the
 * five most distinctive words of his own request returns the item those words
 * produced **0 times out of 42**. Ranked, the same corpus returns it at rank one
 * fifteen times. The signal was there; nothing was reading it.
 *
 * ── WHAT THIS FILE IS AND IS NOT ───────────────────────────────────────────
 *
 * It is an ORDER and a WIDER MATCH, and those are two changes rather than one.
 * The measurement separates them and so does this file, because conflating
 * them is how a report claims a ranker earned a number that coverage earned:
 *
 *   — **COVERAGE.** `searchableText` reads title, body, observations and
 *     `extra`. The corpus also holds a `summary` on essentially every item, a
 *     tag list and an id that is a slug of the title, and none of the three was
 *     readable by `--text`.
 *   — **THE UNION.** `--text` is ONE contiguous substring, so two words the
 *     item holds but does not adjoin return nothing. Scoring the query as
 *     independent terms is the single largest gain in the whole measurement.
 *   — **THE ORDER.** BM25 over those fields, weighted. This is what turns a
 *     pile into an answer.
 *
 * It is NOT a filter. `INV-nothing-is-dropped-silently` stands: `searchItems`
 * returns EVERY item that matched, in an order, and the counts a caller needs
 * to say what it is not showing travel with it. A bound is applied by the
 * caller, after this, and is reported by the caller. **Ranking applied before a
 * scope is how the per-turn anchor pass silently stopped for half an hour**
 * (`nothing-to-do-and-could-not-look-are-different-answers`, rule store), so
 * `searchItems` applies the structured filters FIRST, as a scope, and ranks
 * only inside them.
 *
 * ── WHAT IT RANKS ON, AND WHY THAT AND NOT SOMETHING ELSE ──────────────────
 *
 * A corpus item is not a passage. `FIELD_WEIGHTS` below is the whole of the
 * claim, and each weight is argued at its own line. The short version: a match
 * in a TITLE or a SUMMARY is evidence about what the item IS; a match in a body
 * is evidence that the item MENTIONS something. `test/core/corpus-rank.test.ts`
 * holds the ordering that follows from that and reddens if the weights are
 * reversed.
 *
 * **The honest caveat, because the measurement disagrees with the intuition.**
 * Weighting is worth very little in aggregate — `reports/2026-09-16-the-search-grammar.md`
 * §4 measured column weights on the FTS5 side as a small LOSS (F3 @1 13 against
 * F2's 15). Coverage, not weighting, is what moves the number. The weights are
 * here because they are right per-item and demonstrably so on a two-item
 * fixture, not because they bought the score.
 */
import type { Config } from './config.ts';
import { filterItems, type ItemFilters } from './search.ts';
import type { Item } from './types.ts';

/**
 * **English words too common to carry evidence.** Taken verbatim from
 * `scripts/measure-search-floor.ts`, which is where it was measured; it moved
 * here rather than being copied, because two hand-kept spellings of one list is
 * this project's most-repeated defect and the script now imports this one.
 *
 * It is ASCII-only and English-only ON PURPOSE. A Hebrew stop list would be a
 * second thing to keep, and `HEBREW_PARTICLES` below already records that the
 * Hebrew problem is not stop words at all — it is particles glued to word
 * FRONTS, which is a different repair on a different surface.
 */
const STOP = new Set((
  'a an the and or but if then so that this these those there here is are was were be been being am '
  + 'do does did done doing have has had having i you he she it we they me him her them my your his its our their us '
  + 'for of to in on at by with from into over under about as not no yes very just also only some any all each every '
  + 'what which who whom whose when where why how can could should would will shall may might must now again too '
  + 'more most other another same such own much many few both please thanks thank ok okay go going want '
  + 'need needs like get got make made let lets see look show tell say said give take put use used using one two '
  + 'still even ever always new old best').split(/\s+/));

/**
 * Case-folded, punctuation collapsed to single spaces. Unicode-aware, so
 * Hebrew survives it unchanged.
 */
export function fold(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Every token, folded. */
export function words(s: string): string[] {
  return fold(s).split(' ').filter((t) => t.length > 0);
}

/** The tokens that carry evidence: three characters or more, not a stop word. */
export function content(s: string): string[] {
  return words(s).filter((t) => t.length > 2 && !STOP.has(t));
}

/**
 * **A conflation key, written here rather than taken from npm** — a few dozen
 * lines is the whole of what `CONST-zero-runtime-dependencies` allows, and a
 * stemmer small enough to read is a stemmer whose mistakes are visible.
 *
 * **The ASCII guard is the first line and it is not decoration.** The archive
 * index is FTS5 TRIGRAM and not `unicode61` because Hebrew glues particles onto
 * word FRONTS, and any scheme that assumes English word shape is worse than
 * what already ships. Measured in `reports/2026-09-15-the-search-floor.md` §6:
 * with the guard, this rewrites 0 of 3,547 Hebrew word types.
 *
 * **The trailing-`e` strip is the line that does the work, and that was
 * established by removing it rather than by reasoning.** Delete it and
 * `test/core/search-floor.test.ts` reddens on `batches`/`batch` and
 * `codebases`/`codebase`.
 *
 * Moved here from `scripts/measure-search-floor.ts` unchanged on 2026-09-16,
 * so the thing that ships and the thing that was measured are one function.
 */
export function conflate(term: string): string {
  if (!/^[a-z]+$/.test(term)) return term;              // the ASCII guard
  let s = term;
  if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y';
  else if (s.length > 4 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ed') && !s.endsWith('eed')) s = s.slice(0, -2);
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1);
  if (s.length > 4 && s.endsWith('ly')) s = s.slice(0, -2);
  return s;
}

/** Hebrew particles that glue to a word's FRONT — the reason the index is trigram. */
export const HEBREW_PARTICLES = ['ו', 'ה', 'ב', 'כ', 'ל', 'מ', 'ש'];
export const HEBREW = /[\u0590-\u05FF]/;

/** The query as written, plus the one form with a single front particle removed. */
export function hebrewVariants(term: string): string[] {
  if (!HEBREW.test(term) || term.length < 4 || !HEBREW_PARTICLES.includes(term[0])) return [term];
  return [term, term.slice(1)];
}

/** One field of an item, and what a match in it is worth. */
export interface RankField { text: string; weight: number }

/**
 * **WHAT A MATCH IS WORTH, BY WHERE IT SITS.** The one claim this file makes
 * that a measurement cannot settle for it, so it is argued here and pinned by
 * `test/core/corpus-rank.test.ts`, which reddens if any pair is reversed.
 *
 *   — `title` **3**. A title is the item's name. A word in it is a statement
 *     that the item is ABOUT that word; the same word in a body may be an
 *     aside, a counter-example or a citation of something else.
 *   — `summary` **3**. Equal to the title, and that equality is deliberate. A
 *     summary is written to `STD-a-summary-is-one-plain-sentence-for-someone-who-does-not`,
 *     which FORBIDS project vocabulary — so it is the field most likely to be
 *     written in the words an outsider (or the owner, at the keyboard) would
 *     actually type, rather than in the words an agent settled on afterwards.
 *     Ranking it below the title would penalise the one field that is on the
 *     reader's side of the vocabulary gap.
 *   — `tags` **2**. A tag is a deliberate, curated classification and there are
 *     very few per item, so a hit is strong evidence — but a tag is a label
 *     rather than a claim, and it is not the item's name.
 *   — `id` **2**, de-slugged. An id is a slug OF the title, so it is the title
 *     again in a second spelling; it is weighted below the title rather than
 *     equal to it precisely because it is a duplicate, and double-counting the
 *     title at full strength would quietly make titles worth 5.
 *   — `body`, `observations`, `extra` **1**. The baseline. This is what
 *     `searchableText` already read, and a match here is the weakest of the
 *     evidence rather than none of it.
 *
 * **`request` is deliberately NOT ranked, and that is the owner's to change.**
 * It holds his verbatim words, which makes it the single most valuable field
 * for exactly this problem — and his ruling on it ("documentation only and
 * should not be injected to the context") is about INJECTION, not search, so
 * whether search may read it has never actually been asked. Two reasons it is
 * out today: the ruling is his, and the ground truth this whole build is scored
 * against IS the `request` field, so indexing it would score the fixture rather
 * than the mechanism. Named in the report as the one open question.
 *
 * **`steps` is not ranked either**, for the narrower reason that the
 * measurement never covered it; adding an unmeasured field to claim a measured
 * number is the defect this comment exists to avoid.
 */
export const FIELD_WEIGHTS = {
  title: 3,
  summary: 3,
  tags: 2,
  id: 2,
  body: 1,
  observations: 1,
  extra: 1,
} as const;

/** The fields this ranker reads, each with what a match in it is worth. */
export function rankFields(item: Item): RankField[] {
  const observations = item.observations
    .map((o) => o.text + (o.context === null ? '' : ' ' + o.context)).join('\n');
  return [
    { text: item.title, weight: FIELD_WEIGHTS.title },
    { text: item.summary ?? '', weight: FIELD_WEIGHTS.summary },
    { text: item.tags.join(' '), weight: FIELD_WEIGHTS.tags },
    // De-slugged, because `TASK-the-corpus-box-refuses-to-rank` is seven words
    // joined by hyphens and `fold` would keep none of them findable as words.
    { text: item.id.replace(/-/g, ' '), weight: FIELD_WEIGHTS.id },
    { text: item.body, weight: FIELD_WEIGHTS.body },
    { text: observations, weight: FIELD_WEIGHTS.observations },
    { text: Object.values(item.extra).join('\n'), weight: FIELD_WEIGHTS.extra },
  ];
}

/** A BM25 index over one candidate set. Built per query, thrown away after. */
export interface RankIndex {
  tf: Map<string, number>[];
  len: number[];
  df: Map<string, number>;
  avg: number;
  n: number;
}

/**
 * **The index is built over the SCOPE, not over the corpus**, so `idf` is a
 * statement about the set the caller actually asked about. A term that is
 * common corpus-wide but rare among the twelve items scoped to one file is rare
 * HERE, and that is the question that was asked.
 *
 * Every token is indexed under its surface form AND under its conflation key,
 * but contributes to the document length ONCE. Two keys for one word would
 * otherwise make every document look twice as long as it is and flatten the
 * length normalisation that is half of what BM25 does.
 *
 * `fieldsOf` exists so `scripts/measure-corpus-rank.ts` can score the SHIPPED
 * BM25 against an ALTERNATIVE weighting — flat, reversed, or one field at a
 * time — without a second implementation of the scorer to disagree with this
 * one. Nothing in `src/` ever passes it; the default is the shipped answer.
 * Passing it also switches the memo below OFF, because a memo keyed on the item
 * alone would answer a question about a different weighting.
 */
export function buildIndex(
  items: Item[],
  fieldsOf: (item: Item) => RankField[] = rankFields,
): RankIndex {
  const memoize = fieldsOf === rankFields;
  const tf: Map<string, number>[] = [];
  const len: number[] = [];
  const df = new Map<string, number>();
  for (const item of items) {
    const cached = memoize ? TOKENS.get(item) : undefined;
    const counted = cached ?? countTokens(item, fieldsOf);
    if (memoize && cached === undefined) TOKENS.set(item, counted);
    tf.push(counted.tf);
    len.push(counted.len);
    for (const t of counted.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const total = len.reduce((a, b) => a + b, 0);
  const avg = items.length === 0 ? 1 : total / items.length;
  return { tf, len, df, avg: avg > 0 ? avg : 1, n: items.length };
}

/** One item's weighted term counts and its weighted length. */
interface Counted { tf: Map<string, number>; len: number }

/**
 * **Tokenising 1,295 items costs about a quarter of a second, and doing it
 * again for the next keystroke costs another one.** Measured by
 * `scripts/measure-corpus-rank.ts` §8 before this existed: `searchItems` 250 ms
 * against `filterItems`' 4 ms, on 2.9 MB of body text — the tokenising IS the
 * cost, and the scoring is a millisecond of it.
 *
 * **A `WeakMap` on the ITEM, not a cache with a lifetime.** An `Item` is
 * immutable once loaded; a changed item is a different object, because it comes
 * back from a fresh `loadLayer`/`store.all()`. So there is no invalidation rule
 * to get wrong and no way for this to serve a stale answer — the question "has
 * this object's text changed" cannot be answered `yes`. When the caller hands
 * over new objects the memo simply misses, and when it hands the same ones back
 * (a UI session searching repeatedly against one open store) it hits.
 *
 * It holds no strong reference, so a corpus that is reloaded does not leak the
 * old one.
 */
const TOKENS = new WeakMap<Item, Counted>();

function countTokens(item: Item, fieldsOf: (item: Item) => RankField[]): Counted {
  const tf = new Map<string, number>();
  let len = 0;
  for (const field of fieldsOf(item)) {
    if (field.text === '') continue;
    for (const token of content(field.text)) {
      tf.set(token, (tf.get(token) ?? 0) + field.weight);
      const key = conflate(token);
      if (key !== token) tf.set(key, (tf.get(key) ?? 0) + field.weight);
      len += field.weight;
    }
  }
  return { tf, len };
}

/**
 * What the query asks for: one GROUP per word the reader typed, holding every
 * surface form that word is allowed to match.
 *
 * **A group, not a flat term list, and that is the difference between a gain
 * and a loss.** `measure-search-floor.ts`'s R3 rung REPLACES each query word
 * with its conflation key, which buys `phases`→`phase` and costs the exact
 * form: measured, R3 gains at rank one and LOSES recall outright. Scoring each
 * word once, at the best evidence any of its forms can show, is strictly wider
 * than either — and a word can no longer be counted twice for being spelled two
 * ways in one item.
 */
export function queryGroups(query: string): string[][] {
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const token of content(query)) {
    if (seen.has(token)) continue;
    seen.add(token);
    const forms = new Set<string>();
    for (const variant of hebrewVariants(token)) {
      forms.add(variant);
      forms.add(conflate(variant));
    }
    groups.push([...forms]);
  }
  return groups;
}

const K1 = 1.2;
const B = 0.75;

/** BM25 for one surface form against one document. */
function bm25(index: RankIndex, term: string, doc: number): number {
  const n = index.df.get(term);
  if (n === undefined) return 0;
  const f = index.tf[doc].get(term);
  if (f === undefined) return 0;
  const idf = Math.log(1 + (index.n - n + 0.5) / (n + 0.5));
  return idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * index.len[doc] / index.avg));
}

/**
 * The score of every document in the index, against every group.
 *
 * Each GROUP contributes once, at the best score any of its surface forms can
 * show — see `queryGroups`. Summed across groups, which is what makes this an
 * OR: a document matching three of five words outscores one matching two, and
 * a document matching none scores zero and is not a match at all.
 */
export function scoreAll(index: RankIndex, groups: string[][]): Float64Array {
  const out = new Float64Array(index.n);
  for (const forms of groups) {
    for (let i = 0; i < index.n; i++) {
      let best = 0;
      for (const form of forms) {
        const s = bm25(index, form, i);
        if (s > best) best = s;
      }
      out[i] += best;
    }
  }
  return out;
}

/**
 * **What a ranked search answers with.** Every field here exists so a caller
 * can say what it is not showing — `INV-nothing-is-dropped-silently`. Nothing
 * in this object is truncated; `items` is the complete match set.
 */
export interface SearchOutcome {
  /** Every item that matched, most relevant first. Complete — never bounded. */
  items: Item[];
  /**
   * Whether an ORDER was applied. `false` when no `text` was given, in which
   * case `items` is in the order it arrived (`store.all()`'s `ORDER BY id`) and
   * calling it "most relevant first" would be a lie about a question nobody
   * asked.
   */
  ranked: boolean;
  /**
   * How many of `items` contain the query as ONE contiguous substring — the
   * whole of what the shipped predicate could find. Reported because widening
   * a match and ordering it are two different changes, and a reader deserves to
   * know which half answered them.
   */
  exact: number;
  /** How many matched only by sharing words with the query. */
  widened: number;
  /** How many items the structured filters left to look in. */
  scope: number;
}

/**
 * **The corpus search, ranked** — scope first, then match, then order.
 *
 * ── THE ORDER OF OPERATIONS IS THE LOAD-BEARING PART ───────────────────────
 *
 * 1. **SCOPE.** Every structured filter (`type`, `status`, `tag`, `path`,
 *    `relation`, `linkedTo`, `direction`) is applied by `filterItems` — the one
 *    predicate, not a second spelling of it — with `text` withheld. Whatever
 *    comes back is the set the question was asked about.
 * 2. **MATCH, inside the scope.** An item matches if it contains the query as
 *    one contiguous substring (`filterItems` again, `text` this time — the
 *    SHIPPED predicate, unchanged, which is why the floor cannot move) OR if it
 *    shares at least one content word with the query.
 * 3. **ORDER.** BM25 over `rankFields`, descending; ties by id ascending so two
 *    identical corpora produce identical bytes.
 *
 * **A bound is not a scope, and there is no bound here.** The caller slices and
 * the caller says by how much. Ranking BEFORE a scope is the defect
 * `nothing-to-do-and-could-not-look-are-different-answers` was written about,
 * and this function is shaped so it cannot be built that way by accident: the
 * index is constructed from the scope, so there is nothing to rank until the
 * scope exists.
 *
 * **THE FLOOR CANNOT MOVE, STRUCTURALLY.** Step 2's first clause is a literal
 * call to the predicate that shipped. Every item it returns is in `items`, in
 * some order. `test/core/corpus-rank.test.ts` proves it by removal — delete the
 * clause and the queries only a substring can answer go empty.
 */
export function searchItems(items: Item[], filters: ItemFilters, config: Config): SearchOutcome {
  const { text, ...structural } = filters;
  const scope = filterItems(items, structural, config);
  const query = typeof text === 'string' ? text : '';
  if (query.trim() === '') {
    return { items: scope, ranked: false, exact: 0, widened: 0, scope: scope.length };
  }

  // The SHIPPED predicate, called rather than reimplemented. This is the floor.
  const exactIds = new Set(filterItems(scope, { text }, config).map((i) => i.id));

  const groups = queryGroups(query);
  const index = buildIndex(scope);
  const scores = groups.length === 0 ? new Float64Array(scope.length) : scoreAll(index, groups);

  const hits: { item: Item; score: number }[] = [];
  for (let i = 0; i < scope.length; i++) {
    if (!exactIds.has(scope[i].id) && scores[i] <= 0) continue;
    hits.push({ item: scope[i], score: scores[i] });
  }
  hits.sort((a, b) => (b.score - a.score) || a.item.id.localeCompare(b.item.id));
  return {
    items: hits.map((h) => h.item),
    ranked: true,
    exact: exactIds.size,
    widened: hits.length - exactIds.size,
    scope: scope.length,
  };
}
