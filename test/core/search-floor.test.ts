// @basis TASK-measure-what-finds-a-different-word-for-the-same-idea, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The findings `scripts/measure-search-floor.ts` reports, held as assertions
 * so they cannot rot quietly.**
 *
 * Every test here is a FINDING and is named as one. None of them asserts a
 * behaviour anybody wanted: they pin the shape of a miss that the measurement
 * counted, so that a later change which closes one of these gaps reddens the
 * line that described it and the person closing it is sent to the number.
 *
 * **Each finding carries its own removal proof IN THE SAME RUN.** A test that
 * only asserts "this query finds nothing" is green when the corpus is empty,
 * when the predicate is broken, and when the fixture was built wrong. So every
 * case below also asserts the NEAR MISS — the same word moved one field over,
 * or written the one way the predicate can read — and that half must find the
 * item. A green here therefore means "the detector works and the gap is real",
 * and a fixture that lost its power reddens on the positive half.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { filterItems } from '../../src/core/search.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { conflate, hebrewVariants, HEBREW_PARTICLES } from '../../scripts/measure-search-floor.ts';
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

/**
 * FINDING — the summary is unsearchable, and every item in this corpus has one.
 *
 * Measured over the live corpus: 165,676 characters of summary on 1,252 of
 * 1,252 items, none of it reachable by `search --text`. The summary is the one
 * field written to a standard that FORBIDS project vocabulary
 * (`STD-a-summary-is-one-plain-sentence-for-someone-who-does-not`), which makes
 * it the field most likely to carry the plain word a reader would actually type.
 */
test('FINDING: a word that appears only in an item summary is unreachable by --text', () => {
  const only = item({ id: 'CONST-summary', summary: 'A quokka guards the ledger.', body: 'body' });
  const moved = item({ id: 'CONST-body', body: 'A quokka guards the ledger.' });
  // the finding
  assert.deepEqual(filterItems([only], { text: 'quokka' }, CONFIG), []);
  // the removal proof, in the same run: the same sentence one field over IS found,
  // so the predicate works, the fixture is sound, and the detector can see a red.
  assert.deepEqual(filterItems([moved], { text: 'quokka' }, CONFIG).map((i) => i.id), ['CONST-body']);
});

/**
 * FINDING — the owner's own verbatim words are the one field the text filter
 * cannot read.
 *
 * `request` holds what a PERSON typed, unedited, before any body or summary was
 * derived from it (`src/core/types.ts` · `request`). 42 items carry one. His
 * ruling on that field says "documentation only and should not be injected to
 * the context" — about INJECTION, which is a budget question. Whether the same
 * sentence bars SEARCHING it is his to answer and is not assumed here; the test
 * records only that it is not searched today.
 */
test('FINDING: a word that appears only in an item request is unreachable by --text', () => {
  const only = item({ id: 'TASK-req', request: 'make the quokka stop guarding the ledger' });
  const moved = item({ id: 'TASK-body', body: 'make the quokka stop guarding the ledger' });
  assert.deepEqual(filterItems([only], { text: 'quokka' }, CONFIG), []);
  assert.deepEqual(filterItems([moved], { text: 'quokka' }, CONFIG).map((i) => i.id), ['TASK-body']);
});

/**
 * FINDING — `text` is ONE contiguous substring, so a two-word query fails
 * whenever the corpus does not put those two words next to each other.
 *
 * This is the single largest miss the measurement found, and it is not about
 * meaning at all. On the 42 owner-authored (request, item) pairs, a query of
 * the five most distinctive words of his own request returns the item it
 * produced **0 times out of 42**; the same five words scored as independent
 * terms return it at rank 1 sixteen times.
 */
test('FINDING: two words the item contains but does not adjoin return nothing', () => {
  const split = item({ id: 'TASK-split', body: 'the quokka sat here, and far below, the ledger' });
  const adjacent = item({ id: 'TASK-adjacent', body: 'the quokka ledger' });
  assert.deepEqual(filterItems([split], { text: 'quokka ledger' }, CONFIG), []);
  assert.deepEqual(
    filterItems([adjacent], { text: 'quokka ledger' }, CONFIG).map((i) => i.id), ['TASK-adjacent'],
  );
});

/**
 * FINDING — substring matching already gives prefix matching in ONE direction,
 * and the gap is entirely the other one.
 *
 * `phase` finds `phases` for free, because `phases` contains it. `phases` finds
 * nothing, because no item in this corpus writes the plural — measured, and
 * the same holds for `codebases`, `approaches`, `upgrades`, `narratives`,
 * `subsystems` and `artifacts`. So the repair belongs on the QUERY and not in
 * the index: there is no index here to change.
 */
test('FINDING: a query longer than the stored word misses, and the query is where it is fixed', () => {
  const stored = item({ id: 'TASK-phase', body: 'this lands in phase four' });
  assert.deepEqual(filterItems([stored], { text: 'phase' }, CONFIG).map((i) => i.id), ['TASK-phase']);
  assert.deepEqual(filterItems([stored], { text: 'phases' }, CONFIG), []);
  // the conflation key joins them; the removal proof is the raw pair above,
  // which does not meet.
  assert.equal(conflate('phases'), conflate('phase'));
});

/**
 * The conflation key, both directions.
 *
 * The pairs are the ones this corpus really mixes, taken from the words the
 * owner typed that return nothing today: `phases`, `batches`, `codebases`,
 * `approaches`, `narratives`, `upgrades`, `subsystems`, `artifacts`. The line
 * that earns them is the trailing-`e` strip — deleting it reddens this test on
 * `batches`/`batch`, which is how that was established rather than argued.
 * `process`/`processes` is the case the `ss` guard holds.
 *
 * The second half is the precision half and it matters more than the first. A
 * trigram-nearest repair over the same word list proposed `irelevant ->
 * relevant`, which drops a negation, and `phases -> phrases`. A key that joined
 * either of those would be worse than the miss it replaced.
 */
test('the conflation key joins the forms this corpus actually mixes', () => {
  for (const [a, b] of [
    ['phases', 'phase'], ['batches', 'batch'], ['codebases', 'codebase'],
    ['approaches', 'approach'], ['narratives', 'narrative'], ['upgrades', 'upgrade'],
    ['develops', 'develop'], ['matched', 'matching'], ['processes', 'process'],
  ]) {
    assert.equal(conflate(a), conflate(b), a + ' and ' + b + ' must conflate together');
  }
  // and does NOT join words that merely look alike — the precision half
  for (const [a, b] of [['phases', 'phrases'], ['relevant', 'irrelevant'], ['compose', 'compaction']]) {
    assert.notEqual(conflate(a), conflate(b), a + ' and ' + b + ' must NOT conflate together');
  }
});

/**
 * FINDING — Hebrew glues particles onto word FRONTS, so a query carrying one
 * misses, and neither tokenizer saves it.
 *
 * Measured over 1,322 real Hebrew strings — the shipped UI table plus the
 * Hebrew lines in the corpus — and 3,927 particle+word queries whose bare form
 * is the only one written: FTS5 `trigram` finds 51, FTS5 `unicode61` finds 1.
 * Trigram is 51x better and still 1.3%. Stripping one front particle off the
 * QUERY finds all 3,927.
 *
 * The index is built IN MEMORY. Nothing here opens, reads or writes the
 * workspace's archive.
 */
test('FINDING: a Hebrew query carrying a front particle misses the bare word, under both tokenizers', () => {
  const bare = 'מזהה';
  const glued = 'ה' + bare;
  const build = (tokenize: string): DatabaseSync => {
    const db = new DatabaseSync(':memory:');
    db.exec("CREATE VIRTUAL TABLE t USING fts5(text, tokenize='" + tokenize + "')");
    db.prepare('INSERT INTO t(text) VALUES (?)').run('הטבלה מציגה ' + bare + ' לכל שורה');
    return db;
  };
  const hits = (db: DatabaseSync, q: string): number =>
    (db.prepare('SELECT count(*) c FROM t WHERE t MATCH ?').get('"' + q + '"') as { c: number }).c;
  for (const tokenize of ['trigram', 'unicode61']) {
    const db = build(tokenize);
    try {
      // the removal proof first: the bare word IS found, so the fixture really
      // holds the text and the detector really can see a green.
      assert.equal(hits(db, bare) > 0, true, tokenize + ' must find the bare word');
      // the finding
      assert.equal(hits(db, glued), 0, tokenize + ' must miss the glued form');
      // and the repair, which is on the query and assumes no word boundary
      assert.equal(hebrewVariants(glued).some((v) => hits(db, v) > 0), true);
    } finally {
      db.close();
    }
  }
});

/**
 * The ASCII guard on the conflation key, and the honest result of removing it.
 *
 * The claim that wanted making was "the guard protects Hebrew". Measured, it
 * does not have to: no Hebrew word ends in `s`, `ed`, `ing` or `ly`, so the
 * guarded and unguarded keys rewrite the same 0 of 3,547 Hebrew word types.
 * What the guard really protects against is the NEXT rule somebody adds — one
 * that trims by length rather than by suffix — and that is why it stays. The
 * assertion is written as the measured fact and not as the hoped-for one.
 */
test('the conflation key leaves Hebrew alone, and says why that is not the guard doing it', () => {
  const heb = ['מזהה', 'תצוגה', 'שיחה', 'קובץ', 'שרשור', 'סוכן', 'הרצה', 'עמוד'];
  for (const w of heb) assert.equal(conflate(w), w);
  // the removal proof: take the guard off and the answer is the same, which is
  // the finding. A test asserting damage here would be asserting a story.
  const unguarded = (t: string): string => {
    let s = t;
    if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y';
    else if (s.length > 4 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
    if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
    else if (s.length > 4 && s.endsWith('ed') && !s.endsWith('eed')) s = s.slice(0, -2);
    if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1);
    if (s.length > 4 && s.endsWith('ly')) s = s.slice(0, -2);
    return s;
  };
  for (const w of heb) assert.equal(unguarded(w), w);
  // and the guard demonstrably DOES something, on the input it was written for:
  // a Latin word reaching the same rules is rewritten.
  assert.notEqual(conflate('phases'), 'phases');
  assert.equal(HEBREW_PARTICLES.length, 7);
});
