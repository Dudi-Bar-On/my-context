// @basis TASK-the-corpus-box-refuses-to-rank-so-it-returns-the-right-item, RULE-search-may-rank-its-results-and-semantic-search-is-not, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The corpus search, ranked** — `src/core/rank.ts`.
 *
 * Every claim `rank.ts` makes is here with its own removal proof, and each
 * proof was RUN: the line it names was deleted or inverted, this file was
 * re-run, and the assertion that reddened is recorded beside it in
 * `reports/2026-09-16-the-corpus-box-ranked.md`. A proof that reddens NOTHING
 * is recorded there too, because that is the more valuable finding.
 *
 * ── THE THREE THINGS THIS FILE EXISTS TO STOP ──────────────────────────────
 *
 * 1. **THE FLOOR MOVING.** An item findable by `filterItems` today must still
 *    come back. Ranking reorders; it does not remove. Proved against the real
 *    corpus as well as against fixtures, because a fixture cannot be wrong in
 *    the way a live corpus can.
 * 2. **THE WEIGHTING BEING REVERSED.** `FIELD_WEIGHTS` says a title is worth
 *    three times a body. The fixtures below are built so that LENGTH
 *    NORMALISATION cannot be what decides them — the two documents are the same
 *    length and differ only in WHERE the word sits — so a green here is about
 *    the weights and nothing else.
 * 3. **A BOUND BEFORE A SCOPE.** Ranking applied before the structured filters
 *    is the defect `nothing-to-do-and-could-not-look-are-different-answers`
 *    (rule store) was written about. `searchItems` cannot be built that way by
 *    accident, and the test that says so fails if it is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildIndex, conflate, content, FIELD_WEIGHTS, queryGroups, rankFields, scoreAll, searchItems,
} from '../../src/core/rank.ts';
import { filterItems } from '../../src/core/search.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { loadLayer } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

const ids = (items: Item[]): string[] => items.map((i) => i.id);

/**
 * **Filler of a fixed WORD COUNT**, so two fixtures can be made the same length
 * and the only difference left between them is which field the query word sits
 * in. Words with no letters in common with any query used below, so the filler
 * can never itself be a match.
 */
function filler(n: number): string {
  const pool = ['zophyr', 'vundle', 'kressel', 'mublit', 'jantor', 'quixby', 'frendle'];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool[i % pool.length] + String(i));
  return out.join(' ');
}

/* ══ 1. THE FLOOR ═══════════════════════════════════════════════════════════ */

/**
 * **THE FLOOR, ON A FIXTURE.** Everything `filterItems` returns, `searchItems`
 * returns.
 *
 * The case that makes this non-trivial is the LAST one: a query whose every
 * word is a stop word or shorter than three characters produces NO query terms
 * at all, so the ranked half of the match scores nothing and the substring half
 * is the only thing holding the item in the result. That is the clause the
 * removal proof deletes.
 *
 * REMOVAL PROOF (run): delete the `exactIds` line from `searchItems` and score
 * the union alone. Reddens at `the substring-only query still comes back` and
 * at `a two-character query still comes back` — the two the ranked half cannot
 * see. Recorded in the report.
 */
test('the floor does not move: every substring match is still returned', () => {
  const corpus = [
    item({ id: 'TASK-pool', body: 'the connection pool is exhausted' }),
    item({ id: 'TASK-ui', body: 'the ui is slow' }),
    item({ id: 'TASK-of', body: 'it is a matter of the ui' }),
  ];
  for (const query of ['connection pool', 'is a matter of', 'ui', 'the ui']) {
    const floor = ids(filterItems(corpus, { text: query }, CONFIG));
    const ranked = ids(searchItems(corpus, { text: query }, CONFIG).items);
    for (const id of floor) {
      assert.ok(ranked.includes(id),
        `${JSON.stringify(query)} found ${id} before ranking and does not after`);
    }
  }
  // the two cases the ranked half alone cannot carry, named so the proof has
  // somewhere to redden
  assert.deepEqual(
    ids(searchItems(corpus, { text: 'is a matter of' }, CONFIG).items), ['TASK-of'],
    'the substring-only query still comes back',
  );
  assert.deepEqual(
    ids(searchItems(corpus, { text: 'ui' }, CONFIG).items).sort(), ['TASK-of', 'TASK-ui'],
    'a two-character query still comes back',
  );
});

/**
 * **THE FLOOR, ON THE REAL CORPUS.** This project dogfoods, and a fixture
 * cannot be wrong the way 1,295 real items can.
 *
 * Nine queries drawn from this corpus's own vocabulary, each run through both
 * predicates; every id the shipped filter returns must be in the ranked answer.
 * The `assert.ok(floor.length > 0)` is the fixture-power check: if the corpus
 * ever stops containing these words the comparison becomes vacuous, and a
 * vacuous green is what this project calls a finding rather than a pass.
 */
test('the floor does not move on this project\'s own corpus', () => {
  const ws = resolveWorkspace(process.cwd());
  assert.ok(ws.projectRoot !== null, 'this test runs in the repository');
  const items = loadLayer(ws.projectRoot!, 'project', [], ws.config) as Item[];
  assert.ok(items.length > 100, 'the corpus loaded');
  let compared = 0;
  for (const query of [
    'anchor', 'silently drop', 'injection budget', 'Hebrew', 'supersede',
    'the owner ruled', 'removal proof', 'conversation', 'doctor',
  ]) {
    const floor = ids(filterItems(items, { text: query }, ws.config));
    if (floor.length === 0) continue;
    compared++;
    const ranked = new Set(ids(searchItems(items, { text: query }, ws.config).items));
    for (const id of floor) {
      assert.ok(ranked.has(id), `${JSON.stringify(query)}: ${id} was findable and is not`);
    }
  }
  assert.ok(compared >= 7,
    `only ${compared} of the 9 queries matched anything — the fixture lost its power`);
});

/* ══ 2. THE WEIGHTING ═══════════════════════════════════════════════════════ */

/**
 * **A MATCH IN A TITLE OUTRANKS THE SAME MATCH IN A BODY**, and length is not
 * what decides it.
 *
 * Both items hold exactly the same number of tokens and exactly one occurrence
 * of `quokka`. The only difference is which field it sits in. So BM25's length
 * normalisation is neutral here by construction and `FIELD_WEIGHTS.title`
 * against `FIELD_WEIGHTS.body` is the only thing that can order them.
 *
 * REMOVAL PROOF (run): set `FIELD_WEIGHTS.title` to 1 — reddens here.
 * Set it to 1 AND `body` to 3 (the reversal the item asks to be held) — reddens
 * here and at the summary test below.
 */
test('WEIGHTING: a title match outranks a body match of the same length', () => {
  const pad = filler(40);
  const inTitle = item({ id: 'TASK-title', title: 'quokka ' + pad, body: pad });
  const inBody = item({ id: 'TASK-body', title: pad, body: 'quokka ' + pad });
  assert.equal(FIELD_WEIGHTS.title > FIELD_WEIGHTS.body, true,
    'the claim being held is that a title is worth more than a body');
  assert.deepEqual(
    ids(searchItems([inBody, inTitle], { text: 'quokka' }, CONFIG).items),
    ['TASK-title', 'TASK-body'],
  );
  // and the order does not come from the ARGUMENT order either
  assert.deepEqual(
    ids(searchItems([inTitle, inBody], { text: 'quokka' }, CONFIG).items),
    ['TASK-title', 'TASK-body'],
  );
});

/**
 * **A SUMMARY IS WORTH WHAT A TITLE IS WORTH**, which is the one weight in
 * `FIELD_WEIGHTS` that is an argument rather than an intuition: a summary is
 * written to a standard that forbids project vocabulary, so it is the field
 * most likely to hold the plain word a reader types.
 *
 * Held here as "a summary match outranks a body match", and the equality with
 * the title is asserted on the constant directly — the two-item ordering cannot
 * distinguish 3 from 4, and pretending it could would be a test that passes for
 * a reason it does not state.
 */
test('WEIGHTING: a summary match outranks a body match, and equals a title', () => {
  assert.equal(FIELD_WEIGHTS.summary, FIELD_WEIGHTS.title);
  const pad = filler(40);
  const inSummary = item({ id: 'TASK-summary', title: pad, summary: 'quokka', body: filler(39) });
  const inBody = item({ id: 'TASK-body', title: pad, body: 'quokka ' + filler(39) });
  assert.deepEqual(
    ids(searchItems([inBody, inSummary], { text: 'quokka' }, CONFIG).items),
    ['TASK-summary', 'TASK-body'],
  );
});

/**
 * **THE FIELDS THE SHIPPED FILTER COULD NOT READ ARE READ NOW**, which is the
 * COVERAGE half of this change and the half the measurement says earned the
 * number.
 *
 * Each pair is the finding from `test/core/search-floor.test.ts` and its
 * closure: the same word in the same field, unreachable by `filterItems` and
 * reachable by `searchItems`. The `filterItems` half is the removal proof — it
 * is what makes a green here mean "the gap was real and is closed" rather than
 * "the fixture matched something".
 */
test('COVERAGE: summary, tags and id are searchable, and were not', () => {
  for (const [label, only] of [
    ['summary', item({ id: 'CONST-summary', summary: 'A quokka guards the ledger.' })],
    ['tags', item({ id: 'CONST-tags', tags: ['quokka'] })],
    ['id', item({ id: 'CONST-quokka-guard' })],
  ] as [string, Item][]) {
    assert.deepEqual(filterItems([only], { text: 'quokka' }, CONFIG), [],
      `${label}: the finding — unreachable before`);
    assert.deepEqual(ids(searchItems([only], { text: 'quokka' }, CONFIG).items), [only.id],
      `${label}: and reachable now`);
  }
});

/**
 * **TWO WORDS THE ITEM HOLDS BUT DOES NOT ADJOIN**, the single largest miss the
 * floor measurement found and not a question about meaning at all.
 */
test('COVERAGE: two words the item never adjoins are found, and were not', () => {
  const split = item({ id: 'TASK-split', body: 'the quokka sat here, and far below, the ledger' });
  assert.deepEqual(filterItems([split], { text: 'quokka ledger' }, CONFIG), []);
  assert.deepEqual(ids(searchItems([split], { text: 'quokka ledger' }, CONFIG).items),
    ['TASK-split']);
});

/**
 * **THE CONFLATION GROUP RUNS IN BOTH DIRECTIONS, and does not cost the exact
 * form.** `phases` finds `phase`; `phase` still finds `phases`.
 *
 * The second half is the removal proof for `queryGroups` keeping the surface
 * form alongside the key: index only the key and `phas` becomes the only way in.
 */
test('the conflation group joins phase and phases in both directions', () => {
  const singular = item({ id: 'TASK-one', body: 'this lands in phase four' });
  const plural = item({ id: 'TASK-many', body: 'this lands in four phases' });
  const corpus = [singular, plural];
  assert.deepEqual(ids(searchItems(corpus, { text: 'phases' }, CONFIG).items).sort(),
    ['TASK-many', 'TASK-one']);
  assert.deepEqual(ids(searchItems(corpus, { text: 'phase' }, CONFIG).items).sort(),
    ['TASK-many', 'TASK-one']);
  // the group itself, so a change to `conflate` that broke the pair reddens here
  assert.deepEqual(queryGroups('phases').length, 1);
  assert.ok(queryGroups('phases')[0].includes('phases'), 'the surface form survives');
  assert.ok(queryGroups('phases')[0].includes(conflate('phases')), 'and so does the key');
});

/* ══ 3. SCOPE, BOUND AND THE INVARIANT ══════════════════════════════════════ */

/**
 * **THE SCOPE IS APPLIED BEFORE THE RANK, AND A SCOPE IS NOT A BOUND.**
 *
 * `TASK-hit` would rank first in the whole corpus. Scoped to `--type
 * constraint` it must not appear AT ALL — not demoted, not at rank two. The
 * inverse assertion is the removal proof: without the scope it IS first, so a
 * green here cannot come from the item being unfindable.
 */
test('SCOPE BEFORE RANK: a filtered-out item does not appear, however well it ranks', () => {
  const corpus = [
    item({ id: 'TASK-hit', type: 'task', title: 'quokka quokka quokka' }),
    item({ id: 'CONST-hit', type: 'constraint', body: 'a quokka, mentioned once, in passing ' + filler(40) }),
  ];
  assert.deepEqual(ids(searchItems(corpus, { text: 'quokka' }, CONFIG).items),
    ['TASK-hit', 'CONST-hit'], 'unscoped, the task ranks first');
  assert.deepEqual(
    ids(searchItems(corpus, { text: 'quokka', type: 'constraint' }, CONFIG).items),
    ['CONST-hit'], 'scoped, the task is gone rather than demoted');
});

/**
 * **THE IDF IS A STATEMENT ABOUT THE SCOPE**, which is what "the index is built
 * over the scope" means in practice: narrowing the question changes what counts
 * as a rare word, and it must, because that is the question that was asked.
 *
 * `common` appears in every constraint and in no task. Inside the constraints
 * it carries no information; across the whole corpus it does.
 */
test('SCOPE BEFORE RANK: idf is computed over the scope, not over the corpus', () => {
  const corpus: Item[] = [
    item({ id: 'TASK-a', type: 'task', body: 'rare ' + filler(20) }),
    ...Array.from({ length: 5 }, (_, i) => item({
      id: 'CONST-' + i, type: 'constraint', body: 'common ' + filler(20),
    })),
  ];
  const wide = buildIndex(corpus);
  const scoped = buildIndex(corpus.filter((i) => i.type === 'constraint'));
  assert.equal(wide.df.get('common'), 5);
  assert.equal(scoped.df.get('common'), 5);
  assert.equal(wide.n, 6);
  assert.equal(scoped.n, 5);
  // 5 of 6 is still some evidence; 5 of 5 is none, and the scores say so.
  const inWide = scoreAll(wide, queryGroups('common'));
  const inScope = scoreAll(scoped, queryGroups('common'));
  assert.ok(Math.max(...inWide) > Math.max(...inScope),
    'a word every item in the scope carries is worth less inside that scope');
});

/**
 * **NOTHING IS BOUNDED HERE — `INV-nothing-is-dropped-silently`.**
 *
 * `searchItems` returns the COMPLETE match set. The caller slices and the caller
 * reports. If a limit ever migrates into the ranker, this reddens.
 */
test('NOTHING IS DROPPED: the whole matched set comes back, with its counts', () => {
  const corpus = Array.from({ length: 200 }, (_, i) => item({
    id: 'TASK-' + String(i).padStart(3, '0'), body: 'quokka number ' + i,
  }));
  corpus.push(item({ id: 'TASK-phrase', body: 'a quokka ledger sits here' }));
  const outcome = searchItems(corpus, { text: 'quokka ledger' }, CONFIG);
  assert.equal(outcome.items.length, 201, 'every match, not a page of them');
  assert.equal(outcome.exact, 1, 'one of them holds the phrase');
  assert.equal(outcome.widened, 200, 'the rest share a word');
  assert.equal(outcome.scope, 201, 'and it says what it looked in');
  assert.equal(outcome.items[0].id, 'TASK-phrase');
});

/**
 * **`ranked` IS FALSE WHEN THERE IS NOTHING TO BE RELEVANT TO.**
 *
 * A structured-only filter returns the items in the order they arrived, and the
 * answer says so rather than letting a caller draw "most relevant first" over
 * an alphabetical list. That mislabelling is the whole failure this task is
 * about, one level up.
 */
test('an unranked answer says it is unranked, and keeps the order it was given', () => {
  const corpus = [
    item({ id: 'TASK-b', type: 'task' }),
    item({ id: 'TASK-a', type: 'task' }),
    item({ id: 'CONST-c', type: 'constraint' }),
  ];
  const outcome = searchItems(corpus, { type: 'task' }, CONFIG);
  assert.equal(outcome.ranked, false);
  assert.deepEqual(ids(outcome.items), ['TASK-b', 'TASK-a'], 'given order, not sorted');
  assert.equal(outcome.exact, 0);
  assert.equal(searchItems(corpus, { text: '   ', type: 'task' }, CONFIG).ranked, false,
    'whitespace is not a query');
  assert.equal(searchItems(corpus, { text: 'task' }, CONFIG).ranked, true);
});

/**
 * **TWO IDENTICAL CORPORA PRODUCE IDENTICAL BYTES.** Ties break by id, ascending
 * — the same determinism rule `searchableRelationTypes` records for the
 * vocabulary order.
 */
test('ties break by id, so the answer is deterministic', () => {
  const corpus = [
    item({ id: 'TASK-c', body: 'quokka' }),
    item({ id: 'TASK-a', body: 'quokka' }),
    item({ id: 'TASK-b', body: 'quokka' }),
  ];
  assert.deepEqual(ids(searchItems(corpus, { text: 'quokka' }, CONFIG).items),
    ['TASK-a', 'TASK-b', 'TASK-c']);
  assert.deepEqual(ids(searchItems([...corpus].reverse(), { text: 'quokka' }, CONFIG).items),
    ['TASK-a', 'TASK-b', 'TASK-c']);
});

/**
 * **THE MEMO CANNOT SERVE A STALE ANSWER**, because it is keyed on the item
 * OBJECT and an item is immutable once loaded.
 *
 * The proof is the case that would break a cache with a lifetime: two items
 * with the SAME id and different text, ranked in the same process. A key on the
 * id would answer the second with the first one's tokens.
 */
test('the tokenising memo is keyed on the object, so a same-id rewrite is not stale', () => {
  const first = item({ id: 'TASK-same', body: 'quokka' });
  assert.deepEqual(ids(searchItems([first], { text: 'quokka' }, CONFIG).items), ['TASK-same']);
  const second = item({ id: 'TASK-same', body: 'ledger' });
  assert.deepEqual(searchItems([second], { text: 'quokka' }, CONFIG).items, []);
  assert.deepEqual(ids(searchItems([second], { text: 'ledger' }, CONFIG).items), ['TASK-same']);
});

/* ══ 4. THE FIELD SET IS WHAT IT SAYS IT IS ═════════════════════════════════ */

/**
 * **`request` IS NOT RANKED, and it is not an oversight.**
 *
 * It holds the owner's verbatim words and is the most valuable field in the
 * corpus for this problem; whether SEARCH may read it is his to rule, and the
 * ground truth the ranker is scored against is drawn FROM it, so indexing it
 * would score the fixture. If a later change adds it, this reddens and sends
 * the person adding it to that paragraph.
 */
test('request is deliberately outside the ranked field set', () => {
  const only = item({ id: 'TASK-req', request: 'make the quokka stop guarding the ledger' } as Partial<Item>);
  assert.equal(searchItems([only], { text: 'quokka' }, CONFIG).items.length, 0);
  assert.deepEqual(rankFields(only).map((f) => f.text).join('\n').includes('quokka'), false);
  // the removal proof: the same sentence in a field that IS ranked is found
  const moved = item({ id: 'TASK-body', body: 'make the quokka stop guarding the ledger' });
  assert.deepEqual(ids(searchItems([moved], { text: 'quokka' }, CONFIG).items), ['TASK-body']);
});

/**
 * **THE STOP LIST AND THE THREE-CHARACTER FLOOR ARE THE SAME ONE THE
 * MEASUREMENT USED**, which is now a fact about one function rather than about
 * two that agree. `scripts/measure-search-floor.ts` imports `conflate`,
 * `content` and `fold` from `src/core/rank.ts` since 2026-09-16; this pins the
 * behaviour those numbers rest on.
 */
test('content() drops stop words and anything under three characters', () => {
  assert.deepEqual(content('The quokka is on a ledger'), ['quokka', 'ledger']);
  assert.deepEqual(content('ui is on'), []);
  assert.deepEqual(content('ORDER By Id'), ['order']);
});

/**
 * **THE MEASUREMENT SCRIPT AND THE SHIPPED RANKER ARE ONE IMPLEMENTATION.**
 *
 * `scripts/measure-search-floor.ts` used to define `conflate`, the stop list and
 * the folding itself. They moved into `src/core/rank.ts` on 2026-09-16 and the
 * script imports them; its scored output was byte-identical across the move.
 * This is the gate that keeps it that way — a re-declared copy in the script
 * would make its numbers a statement about code that does not ship.
 */
test('the floor measurement imports its key from the shipped module', () => {
  const src = readFileSync(path.join(process.cwd(), 'scripts/measure-search-floor.ts'), 'utf8');
  assert.ok(/from '\.\.\/src\/core\/rank\.ts'/.test(src),
    'measure-search-floor.ts imports from src/core/rank.ts');
  assert.equal(/^export function conflate/m.test(src), false,
    'and does not re-declare conflate');
});

/**
 * **NO SECOND BM25 IN `src/`.** The one this project keeps re-learning: two
 * hand-kept expressions of one rule drift. `conversation-search.ts` uses
 * SQLite's compiled `bm25()` and this module is the only hand-written scorer;
 * a third would be the defect.
 */
test('src/ holds exactly one hand-written scorer', () => {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      // The formula's own shape: the k1 saturation term. `bm25(` alone would
      // match the SQL function name `conversation-search.ts` passes to SQLite,
      // which is the compiled one and is not a second implementation.
      if (/K1 \* \(1 - B \+ B \*/.test(readFileSync(p, 'utf8'))) found.push(p);
    }
  };
  walk(path.join(process.cwd(), 'src'));
  assert.deepEqual(found.map((p) => path.basename(p)), ['rank.ts']);
});
