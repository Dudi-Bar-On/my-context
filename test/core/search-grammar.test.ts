// @basis TASK-the-conversation-search-takes-one-substring-and-nothing-else, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The properties of FTS5 UNDER THE TRIGRAM TOKENIZER that
 * `scripts/measure-search-grammar.ts`' recommendation rests on, held as
 * assertions so they cannot change under it quietly.**
 *
 * ── WHY THESE ARE WORTH A TEST WHEN THEY ASSERT NOBODY'S CODE ──────────────
 *
 * Every case here is a property of the SQLite that Node 24 bundles, not of
 * anything in `src/`. That is exactly why they are pinned. The whole of
 * `semantic/2`'s recommendation — a tiered answer, a per-term floor, a
 * character-distance proximity operator — is built on behaviour that is
 * documented nowhere, because it is not FTS5's documented behaviour: it is what
 * FTS5's documented behaviour becomes when the tokenizer emits one token per
 * CHARACTER. A Node upgrade that moved SQLite could change any of it, and
 * nothing else in this repository would notice.
 *
 * **Each finding carries its own removal proof in the same run**, on
 * `test/core/search-floor.test.ts`' pattern: a test that only asserts "this
 * matches nothing" is green when the fixture is empty and green when the table
 * was never created. So every negative here sits beside the positive that
 * proves the fixture can answer at all.
 *
 * These build their own tiny in-memory tables and touch neither the archive
 * index nor the corpus — `DatabaseSync(':memory:')` and nothing else, so the
 * run is deterministic and is not a measurement of this machine's data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIN_TERM_CHARS, median, quoteTerm, tiersOf } from '../../scripts/measure-search-grammar.ts';

/** A throwaway trigram index over the given strings, one row each. */
function index(docs: string[]): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE VIRTUAL TABLE t USING fts5(x, tokenize='trigram')");
  const ins = db.prepare('INSERT INTO t(rowid, x) VALUES (?, ?)');
  docs.forEach((d, i) => ins.run(i, d));
  return db;
}

/** The rowids one FTS5 query returns, as a set. */
function found(db: DatabaseSync, match: string): Set<number> {
  return new Set((db.prepare('SELECT rowid FROM t WHERE t MATCH ?').all(match) as { rowid: number }[])
    .map((r) => Number(r.rowid)));
}

/**
 * FINDING — under trigram, `NEAR(a b, N)` is a distance in CHARACTERS, and the
 * law is `at most N-2 characters between the two substrings`.
 *
 * This is the single property the recommendation's middle tier is. FTS5
 * documents NEAR in TOKENS; a trigram tokenizer emits one token per character
 * position, so the token window and the character window are the same window.
 * Measured in section 2 of the script over 41 synthetic gaps, and pinned here
 * at the two boundaries that matter: the largest gap that must match and the
 * smallest that must not.
 */
test('FINDING: NEAR under trigram admits exactly N-2 characters between the terms', () => {
  const gaps = Array.from({ length: 41 }, (_, g) => 'alpha' + '.'.repeat(g) + 'omega');
  const db = index(gaps);
  for (const n of [2, 5, 12, 30]) {
    const hit = found(db, `NEAR("alpha" "omega", ${n})`);
    // every gap up to N-2 is in
    for (let g = 0; g <= n - 2; g++) assert.ok(hit.has(g), `NEAR ${n} should admit a gap of ${g}`);
    // and N-1 is the first one out — the removal proof for the line above
    assert.ok(!hit.has(n - 1), `NEAR ${n} should refuse a gap of ${n - 1}`);
  }
  // A window of zero admits nothing, which is a real answer and not an error.
  assert.equal(found(db, 'NEAR("alpha" "omega", 0)').size, 0);
});

/**
 * FINDING — the `*` prefix operator is a NO-OP under trigram.
 *
 * A trigram index already matches any substring, so `"byte"*` and `"byte"`
 * return the same rows. It is pinned because a prefix checkbox is the single
 * most likely thing for somebody to add to a search box, and it would cost a
 * control, a label, two translations and a test to deliver nothing at all.
 */
test('FINDING: a trailing `*` changes nothing under trigram, because substrings already match', () => {
  const db = index(['the bytes moved', 'a BYTE arrived', 'abytec', 'nothing here']);
  const plain = found(db, '"byte"');
  assert.deepEqual([...found(db, '"byte"*')].sort(), [...plain].sort());
  // the removal proof: the fixture CAN distinguish two queries, so the equality
  // above is a finding about `*` and not about an index that answers everything
  // the same way.
  assert.notDeepEqual([...plain].sort(), [...found(db, '"moved"')].sort());
  // and the substring claim the no-op rests on, stated rather than implied
  assert.ok(plain.has(2), '"byte" must match inside "abytec" — this is what makes `*` pointless');
});

/**
 * FINDING — a term shorter than a trigram is a SILENT ZERO, and inside a
 * boolean it takes the whole query with it.
 *
 * `MIN_QUERY_CHARS` in `core/conversation-search.ts` guards the WHOLE query and
 * is right for one substring: a two-character query is refused with a sentence
 * that says the index cannot match it, which is
 * `INV-nothing-is-dropped-silently` being honoured. Split the same query into
 * terms and the guard is in
 * the wrong place — the query is four characters long, passes, and returns an
 * empty answer that reads as "not here".
 */
test('FINDING: a sub-trigram term silently empties the boolean it appears in', () => {
  const db = index(['the ui search box', 'another search box']);
  assert.equal(found(db, '"search"').size, 2, 'the fixture answers');
  assert.equal(found(db, '"ui"').size, 0, 'two characters match nothing — the floor');
  // the finding: a legal, four-character query with a real answer available
  // returns nothing, and raises nothing that would tell a caller why
  assert.equal(found(db, '"ui" AND "search"').size, 0);
  // the removal proof: drop the short term and the same query answers
  assert.equal(found(db, '"search"').size, 2);
  assert.equal(MIN_TERM_CHARS, 3);
});

/**
 * FINDING — the three readings of a two-word query are strictly NESTED, so a
 * tiered answer cannot lose a hit the shipped search already returns.
 *
 * Measured on 178 of his own two-word phrases against the real archive in
 * section 3 (178/178 both ways). Pinned here on a fixture built to contain one
 * document of each kind, so the nesting is asserted rather than counted.
 */
test('FINDING: phrase is a subset of NEAR is a subset of AND, for terms of three characters or more', () => {
  const db = index([
    'alpha omega',                                   // 0 — contiguous
    'alpha, then omega',                             // 1 — near
    'alpha at the start and, a long way after, omega', // 2 — both present, far apart
    'omega on its own',                              // 3 — one term only
  ]);
  const [phrase, near, and] = tiersOf(['alpha', 'omega'], 12).map((m) => found(db, m));
  assert.deepEqual([...phrase].sort(), [0]);
  assert.deepEqual([...near].sort(), [0, 1]);
  assert.deepEqual([...and].sort(), [0, 1, 2]);
  for (const r of phrase) assert.ok(near.has(r), 'phrase must be inside NEAR');
  for (const r of near) assert.ok(and.has(r), 'NEAR must be inside AND');
});

/**
 * FINDING — and the nesting above is FALSE in Hebrew, because Hebrew words are
 * short enough to fall under the trigram floor.
 *
 * This is the counterexample that decides the ORDER of the tiers. Measured on
 * the shipped Hebrew string table: 24.9% of adjacent Hebrew word pairs contain
 * a word of fewer than three characters, and for those the split is strictly
 * worse than the substring that ships today. A surface that REPLACED the phrase
 * reading with a boolean one would therefore lose real Hebrew hits; a surface
 * that shows the phrase reading FIRST and the boolean readings after it cannot.
 *
 * The pair is the real one section 5 finds in the fixture.
 */
test('FINDING: in Hebrew a split can find LESS than the substring it replaced', () => {
  const db = index(['הם רשות', 'רשות אחרת']);
  const pair = 'הם רשות';
  const [a, b] = pair.split(' ');
  assert.equal(a.length, 2, 'the first word is two letters — which is ordinary in Hebrew');
  // what ships finds it
  assert.equal(found(db, quoteTerm(pair)).size, 1);
  // the split does not, and says nothing
  assert.equal(found(db, `${quoteTerm(a)} AND ${quoteTerm(b)}`).size, 0);
  // the removal proof: the longer term alone answers, so the fixture is sound
  // and the zero above is the short term's doing
  assert.equal(found(db, quoteTerm(b)).size, 2);
});

/**
 * FINDING — stripping one Hebrew front particle can leave a term the index
 * cannot match at all, so a strip must ADD a variant and never replace one.
 *
 * 157 of 157 three-letter Hebrew word types in the shipped string table that
 * begin with a particle letter strip down to two characters. `hebrewVariants`
 * already returns BOTH forms; this pins what a caller must not do with them.
 */
test('FINDING: a stripped Hebrew particle can leave a term below the trigram floor', () => {
  const glued = 'בהם';  // three letters, begins with a particle
  const bare = glued.slice(1);          // two letters — unmatchable
  const db = index(['אותם ' + glued + ' של']);
  assert.equal(found(db, quoteTerm(glued)).size, 1, 'as written, it is found');
  assert.equal(found(db, quoteTerm(bare)).size, 0, 'stripped, it is below the floor');
  assert.ok(bare.length < MIN_TERM_CHARS);
});

/** The median helper the script reports its precision column with. */
test('median takes the upper middle of an even list and does not mutate its input', () => {
  const a = [5, 1, 4, 2];
  assert.equal(median(a), 4);
  assert.deepEqual(a, [5, 1, 4, 2]);
  assert.equal(median([]), 0);
  assert.equal(median([7]), 7);
});

/** A reader's `"` must be searched for, not obeyed — `searchArchive`'s rule, per term. */
test('quoteTerm doubles an embedded quote so a reader\'s punctuation is data', () => {
  assert.equal(quoteTerm('byte'), '"byte"');
  assert.equal(quoteTerm('say "no"'), '"say ""no"""');
  const db = index(['he said "no" and left', 'he said nothing']);
  assert.deepEqual([...found(db, quoteTerm('said "no"'))], [0]);
});
