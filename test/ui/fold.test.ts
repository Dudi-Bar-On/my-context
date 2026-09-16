// @basis TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you,
// INV-nothing-is-dropped-silently,
// CONST-zero-runtime-dependencies,
// CONST-node-24-no-build-step
/**
 * **THE FOLDED MATCHER** — `src/ui/public/lib/fold.js`, `semantic/8`.
 *
 * Owner ruling 2026-09-16: *"3 write 40 lines of code - just verify it works
 * the same as the original code intended"*. The original is `SearchCursor`
 * from `@codemirror/search` 6.7.2 (MIT), which lane AI costed at ~148 lines
 * and recommended vendoring; the owner chose to write it instead, so what has
 * to be shown is not that the code is the same but that the ANSWERS are.
 *
 * ── HOW THE EQUIVALENCE WAS TAKEN, AND WHY THE TABLE IS GOLDEN ────────────
 *
 * By EXECUTION and not by reading. `SearchCursor` and the three
 * `@codemirror/state` char helpers it needs were extracted from the published
 * tarballs into a scratch directory, given a three-line duck-typed `text`
 * (the five members lane AI identified: `length`, `iterRange`, `iter.next`,
 * `iter.value`, `iter.done`), and run beside this matcher:
 *
 *     24 of 24 synthetic cases agree — identical `from`, `to` and `precise`
 *     11,364 REAL archive spans x 20 queries: 1,775,487 hits, 0 differences
 *     and 0 byte-offset mismatches
 *
 * `reports/2026-09-16-folding-and-highlight.md` carries the run. **What is in
 * THIS file is the golden table that run produced**, not the upstream source:
 * embedding `SearchCursor` to compare against would mean vendoring it — a
 * `LICENSE-codemirror.txt`, a `VENDOR.md` section and a SHA-256 pin — for a
 * library the owner ruled out. So the table is upstream's answers, recorded,
 * and the report says where they came from. A future edit that changes an
 * answer reddens the exact row it changed.
 *
 * ── AND THE PART UPSTREAM DOES NOT ANSWER AT ALL ─────────────────────────
 *
 * `SearchCursor` answers in UTF-16 code units. This project's currency is
 * UTF-8 BYTES, and they differ by 53,268 bytes over one session's spans. The
 * byte assertions below have no golden counterpart because upstream has no
 * opinion: they are checked against `TextEncoder`, which is the definition.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

const FOLD = new URL('../../src/ui/public/lib/fold.js', import.meta.url).href;

interface Hit {
  from: number; to: number; byteFrom: number; byteTo: number; precise: boolean;
}
const { foldedMatches, foldedHolds } = (await import(FOLD)) as {
  foldedMatches: (text: string, query: string, limit?: number) => Hit[];
  foldedHolds: (text: string, query: string) => boolean;
};

const shape = (hits: Hit[]): [number, number, boolean][] =>
  hits.map((h) => [h.from, h.to, h.precise]);

const utf8 = (s: string): number => new TextEncoder().encode(s).length;

describe('the folded matcher reaches the same answers as SearchCursor', () => {
  /**
   * **THE GOLDEN TABLE.** Every row is `[text, query, upstream's answer]`,
   * where the answer is `[from, to, precise]` per hit, printed by
   * `@codemirror/search@6.7.2`'s own `SearchCursor` on 2026-09-16 with
   * `normalize: (x) => x.toLowerCase()` — the composition this matcher uses.
   */
  const GOLDEN: [string, string, [number, number, boolean][]][] = [
    // The headline: this product writes `…` 3,062 times and a reader types
    // three dots. It is an EXACT match, not a wide one.
    ['a \u2026 b', '...', [[2, 3, true]]],
    // Two dots inside a three-dot expansion: the range is the whole ellipsis
    // and `precise` says so. This is the case a silent matcher gets wrong.
    ['a \u2026 b', '..', [[2, 3, false]]],
    ['\u2026\u2026\u2026\u2026', '...', [[0, 1, true], [1, 2, true], [2, 3, true], [3, 4, true]]],
    // A query that can begin again inside itself. The partial-match list is
    // the only reason this is right.
    ['aaab', 'aab', [[1, 4, true]]],
    ['\ufb01le \ufb01le', 'file', [[0, 3, true], [4, 7, true]]],
    // NFKD is not NFKC and does not undo the German sharp s.
    ['Stra\u00dfe', 'strasse', []],
    ['\u00f6', 'o', [[0, 1, false]]],
    ['\u00f6', '\u00f6', [[0, 1, true]]],
    ['\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd', '\u05dc\u05d5\u05dd', [[1, 4, true]]],
    ['\uff21\uff22\uff23', 'abc', [[0, 3, true]]],
    ['\u00bd cup', '1\u20442', [[0, 1, true]]],
    // Astral characters: two UTF-16 units, one code point, and the offsets
    // must still be the original's.
    ['x\u{1d400}y', '\u{1d400}', [[1, 3, true]]],
    ['x\u{1d400}y', 'a', [[1, 3, true]]],
    ['x\u{1f600}y', '\u{1f600}', [[1, 3, true]]],
    ['x\u{1f600}y', 'x\u{1f600}y', [[0, 4, true]]],
    ['\u2139\ufe0f note', 'i', [[0, 1, true]]],
    ['\u2460\u2461\u2462', '123', [[0, 3, true]]],
    // A decomposed `a` + combining acute, searched for as the precomposed
    // character, and the reverse. Both reach it; the offsets differ because
    // the ORIGINALS differ, which is the whole point of answering in them.
    ['a\u0301bc', '\u00e1', [[0, 2, true]]],
    ['\u00e1 bc', 'a\u0301', [[0, 1, true]]],
    ['abc', '', []],
    ['\u2260\u2260', '=', [[0, 1, false], [1, 2, false]]],
    ['\uff5cpipe', '|', [[0, 1, true]]],
    ['\u00b5m and \u03bcm', '\u03bc', [[0, 1, true], [7, 8, true]]],
    // The two this file's byte assertions below stand on, so the UTF-16
    // half of those numbers is upstream's and not this lane's.
    ['\u2026\u2026\u2026\u2026\u2026x byte offset', 'byte offset', [[7, 18, true]]],
    ['\u05e9\u05dc\u05d5\u05dd byte offset \u05e2\u05d5\u05dc\u05dd', 'byte offset', [[5, 16, true]]],
  ];

  for (const [text, query, expected] of GOLDEN) {
    it(`${JSON.stringify(text)} / ${JSON.stringify(query)}`, () => {
      assert.deepEqual(shape(foldedMatches(text, query)), expected);
    });
  }
});

describe('the folded matcher', () => {
  it('reaches an ellipsis a reader typed as three dots, which is the whole task', () => {
    // 3,062 of these in this product's own prose, and neither FTS5 under
    // trigram nor a plain `indexOf` reaches one of them from `...`.
    const text = 'the head of it…and the rest';
    assert.equal(text.includes('...'), false, 'the removal proof: a plain substring finds nothing');
    assert.equal(foldedMatches(text, '...').length, 1);
    assert.equal(foldedHolds(text, '...'), true);
  });

  it('answers in UTF-8 bytes as well as in UTF-16 units, and they are not the same number', () => {
    const text = '\u05e9\u05dc\u05d5\u05dd byte offset \u05e2\u05d5\u05dc\u05dd';
    const [hit] = foldedMatches(text, 'byte offset');
    assert.ok(hit !== undefined);
    // The two currencies diverge here by exactly the Hebrew before the match.
    // `from` is upstream's own answer — it is the last row of GOLDEN above.
    assert.equal(hit.from, 5);
    assert.equal(hit.byteFrom, 9);
    assert.notEqual(hit.from, hit.byteFrom);
    assert.equal(hit.byteFrom, utf8(text.slice(0, hit.from)));
    assert.equal(hit.byteTo, utf8(text.slice(0, hit.to)));
  });

  it('keeps the byte offset true across a character that CHANGES LENGTH under NFKD', () => {
    // 376 spans in one session change length under normalisation. The
    // obvious implementation — normalise, `indexOf`, map back — is wrong for
    // every offset after the first such character, and wrong SILENTLY.
    const text = '\u2026\u2026\u2026\u2026\u2026x byte offset';
    const [hit] = foldedMatches(text, 'byte offset');
    assert.ok(hit !== undefined);
    // 7, and upstream says 7 — the second-to-last row of GOLDEN above. The
    // normalised string has the match at 17, which is the wrong answer a
    // normalise-then-indexOf implementation would give and would never raise.
    assert.equal(hit.from, 7, 'the offset is in the ORIGINAL, where the ellipses are one unit each');
    assert.notEqual(hit.from, text.normalize('NFKD').indexOf('byte offset'));
    assert.equal(hit.byteFrom, utf8(text.slice(0, hit.from)));
  });

  it('folds case, because the index it stands beside folds case', () => {
    assert.equal(foldedMatches('BYTE OFFSET', 'byte offset').length, 1);
    assert.equal(foldedMatches('byte offset', 'BYTE OFFSET').length, 1);
  });

  it('is exhaustively identical to the general path over every ASCII code point', () => {
    // The fast path is what took a whole-session scan from 717 ms to 116 ms,
    // and it rests on a claim about all 128 of them rather than on the
    // typical ones: NFKD-stable, and `toLowerCase` is `A`-`Z` plus 32.
    for (let code = 0; code < 0x80; code += 1) {
      const raw = String.fromCharCode(code);
      const general = raw.normalize('NFKD').toLowerCase();
      const fast = String.fromCharCode(code >= 0x41 && code <= 0x5a ? code + 0x20 : code);
      assert.equal(general, fast, `U+${code.toString(16).padStart(4, '0')}`);
    }
  });

  it('returns non-overlapping hits in document order', () => {
    const hits = foldedMatches('aaaa', 'aa');
    assert.deepEqual(hits.map((h) => [h.from, h.to]), [[0, 2], [2, 4]]);
  });

  it('matches a term below the trigram floor, because no index is involved', () => {
    // `MIN_QUERY_CHARS` is a bound of the FTS5 trigram tokenizer. 14.5% of the
    // Hebrew OCCURRENCES in this corpus are words shorter than three
    // characters, and a JavaScript scan has no such floor.
    assert.equal(foldedMatches('הם רשות', 'הם').length, 1);
    assert.equal(foldedMatches('ab', 'ab').length, 1);
  });

  it('has no word boundary, because a trigram index has none either', () => {
    // Searching `byte offset` finds it inside `byte offsets`, which is what
    // the archive search one surface along already does.
    assert.equal(foldedMatches('holds byte offsets into', 'byte offset').length, 1);
  });

  it('bounds its answer when asked, and the bound is the caller\'s', () => {
    assert.equal(foldedMatches('aaaaaaaa', 'a').length, 8);
    assert.equal(foldedMatches('aaaaaaaa', 'a', 3).length, 3);
    assert.equal(foldedMatches('aaaaaaaa', 'a', 0).length, 0);
    // **AND ON THE OTHER PATH TOO**, which the first draft of this test did
    // not reach: every character above is ASCII, so deleting the bound from
    // the general branch reddened nothing at all. These are folded characters
    // and they take it.
    const folded = '………………';
    assert.equal(foldedMatches(folded, '...').length, 6);
    assert.equal(foldedMatches(folded, '...', 2).length, 2);
  });

  it('finds nothing for an empty query rather than everything', () => {
    assert.deepEqual(foldedMatches('anything at all', ''), []);
    assert.deepEqual(foldedMatches('anything at all', '   '), []);
    assert.equal(foldedHolds('anything at all', ''), false);
  });

  it('foldedHolds agrees with foldedMatches and stops at the first answer', () => {
    assert.equal(foldedHolds('a … b … c', '...'), foldedMatches('a … b … c', '...').length > 0);
    assert.equal(foldedHolds('nothing here', '...'), false);
  });
});
