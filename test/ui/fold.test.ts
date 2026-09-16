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
interface Asked {
  ok: boolean;
  error: string | null;
  slow: boolean;
  regex: boolean;
  unicode: boolean;
  find?: (text: string, limit?: number) => Hit[];
}
interface Options { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }
const { foldedMatches, foldedHolds, findQuery, nestedQuantifier } = (await import(FOLD)) as {
  foldedMatches: (text: string, query: string, limit?: number) => Hit[];
  foldedHolds: (text: string, query: string) => boolean;
  findQuery: (query: string, options?: Options) => Asked;
  nestedQuantifier: (source: string) => boolean;
};

/**
 * `findQuery` then `find`, in one call, because every option assertion below
 * is about the ANSWER rather than about the compile. A query that will not
 * compile answers `[]` here and has its own tests further down, where the
 * difference between "found nothing" and "was not run" is the subject.
 */
const findAll = (
  text: string, query: string, options: Options = {}, limit?: number,
): Hit[] => {
  const asked = findQuery(query, options);
  return asked.ok === true && asked.find !== undefined ? asked.find(text, limit) : [];
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

/**
 * **THE THREE OPTIONS THE OWNER ASKED FOR TWICE** — `semantic/9`,
 * `TASK-the-find-options-the-owner-asked-for-twice-in-a-floating`.
 *
 * `reports/2026-09-16-the-search-grammar.md` §6 refused all three, and its
 * refusals are about the FTS5 TRIGRAM INDEX behind `searchArchive`: regex
 * *"cannot use the index at all"*, whole word *"would have to be a post-filter
 * in JS over every hit"*, case *"would mean a second index or a post-filter"*.
 * The find bar has no index — `findInDocument` is already a JavaScript scan —
 * so every one of those three sentences describes a cost this surface was
 * already paying. The owner overruled the refusal; the measurements stand.
 *
 * **Each assertion below is a removal proof and each names what it reddens.**
 */
describe('the find options are decided once, in the matcher, for both runtimes', () => {
  /**
   * **CASE AND FOLDING ARE TWO AXES.** The item's own words. Deleting
   * `keepCase` from `fold()` reddens the second line; conflating the two —
   * dropping `.normalize('NFKD')` when case is kept — reddens the third,
   * which is the assertion that stops the obvious "simplification".
   */
  it('matches case only when asked, and never stops folding to do it', () => {
    assert.equal(findAll('Byte and byte', 'byte').length, 2);
    assert.equal(findAll('Byte and byte', 'byte', { caseSensitive: true }).length, 1);
    // Case ON still finds the ellipsis from three typed dots. This is the
    // line that reddens if the two axes are ever collapsed into one flag.
    assert.equal(findAll('a … b', '...', { caseSensitive: true }).length, 1);
    // And it is still case-sensitive about the letters around the folded
    // character — one axis on, one axis unchanged, in a single query.
    assert.equal(findAll('A… a…', 'a...').length, 2);
    assert.equal(findAll('A… a…', 'a...', { caseSensitive: true }).length, 1);
    /*
     * **AND ON THE GENERAL PATH, WHICH A REMOVAL PROOF FOUND MISSING.**
     * Deleting `keepCase` from `fold()` itself reddened NOTHING on the first
     * run: every case fixture above is ASCII, so only the fast path was ever
     * entered and the general path's own `fold(raw, keepCase)` was uncovered.
     * `Á` is one code point whose NFKD is two, so this line goes through it.
     */
    assert.equal(findAll('Á á', 'á').length, 2);
    assert.equal(findAll('Á á', 'á', { caseSensitive: true }).length, 1);
  });

  it('keeps the ASCII fast path honest when case is kept', () => {
    // The fast path lowercases A-Z by adding 32. With `keepCase` it must not,
    // and every character here is ASCII, so this reddens on THAT branch —
    // the general branch is never entered.
    assert.equal(findAll('ABC abc', 'abc', { caseSensitive: true }).length, 1);
    assert.equal(findAll('ABC abc', 'ABC', { caseSensitive: true }).length, 1);
    assert.equal(findAll('ABC abc', 'abc').length, 2);
  });

  /**
   * **WHOLE WORD, AND THE HEBREW HALF IS THE POINT.** §6 refused it because
   * *"in Hebrew it is worse than useless, because the whole reason this index
   * is trigram is that Hebrew glues particles onto word fronts"*. That is
   * measured and TRUE, and it is why the panel draws a sentence saying what
   * the toggle drops rather than why it does not exist.
   */
  it('requires a boundary only at an end that is a word character', () => {
    assert.equal(findAll('cat category', 'cat').length, 2);
    assert.equal(findAll('cat category', 'cat', { wholeWord: true }).length, 1);
    // **THE LINE THAT MAKES THE OPTION SAFE TO TICK.** Without the
    // "only at an end that is itself a word character" rule, a reader who
    // ticks Whole word and types three dots gets zero for ever — the one
    // query `semantic/8` exists for.
    assert.equal(findAll('a … b', '...', { wholeWord: true }).length, 1);
    assert.equal(findAll('a -word b', '-word', { wholeWord: true }).length, 1);
    /*
     * **THE TWO ABOVE ARE SURROUNDED BY SPACES, WHICH A REMOVAL PROOF SHOWED
     * IS NOT ENOUGH.** Requiring a boundary at EVERY end rather than at every
     * end that is itself a word character reddened nothing, because a space
     * satisfies both rules. These put a LETTER against the end that has no
     * word character of its own, which is the only place the two rules differ.
     */
    assert.equal(findAll('a…b', '...', { wholeWord: true }).length, 1);
    assert.equal(findAll('x-word y', '-word', { wholeWord: true }).length, 1);
  });

  it('drops the glued Hebrew front particle, which is what a boundary means', () => {
    assert.equal(findAll('השורה וגם שורה.', 'שורה').length, 2);
    assert.equal(findAll('השורה וגם שורה.', 'שורה', { wholeWord: true }).length, 1);
    // `\w` would call every Hebrew letter a non-word character and report
    // that BOTH are already whole words. This is the assertion that reddens
    // if `\p{L}` is ever traded for `\w`.
    assert.equal(findAll('השורה', 'שורה', { wholeWord: true }).length, 0);
  });

  it('a refused occurrence does not eat the partials behind it', () => {
    assert.equal(findAll('aaa', 'aa', { wholeWord: true }).length, 0);
    assert.equal(findAll('aa aa', 'aa', { wholeWord: true }).length, 2);
    /*
     * **THE ASYMMETRY, AND FINDING A CASE FOR IT TOOK WORK.** A hit that is
     * TAKEN consumes its text, so upstream empties the partial list; a hit
     * the caller REFUSES consumed nothing, so a later match that began inside
     * it is still a match. The three lines above redden on neither rule,
     * which a removal proof showed — whole-word rejection normally rejects an
     * overlapping neighbour too, because the neighbour begins inside a run of
     * word characters.
     *
     * `a-a` in `ba-a-a ` is the shape where it does not. The occurrence at 1
     * is refused (a `b` is glued to its front); the one at 3 OVERLAPS it and
     * is a whole word, because a hyphen is not a word character. Clearing the
     * partials on the refusal loses it and this answers `[]`.
     */
    const kept = findAll('ba-a-a ', 'a-a', { wholeWord: true });
    assert.equal(kept.length, 1);
    assert.equal(kept[0]!.from, 3, 'the accepted match is the one that overlapped the refused one');
    // The control: with no option at all the FIRST occurrence wins and the
    // overlapping one is dropped, which is upstream's own rule and unchanged.
    assert.equal(findAll('ba-a-a ', 'a-a')[0]!.from, 1);
  });

  /**
   * **REGULAR EXPRESSIONS READ THE TEXT AS WRITTEN.** Folding the text under
   * a pattern would change what every offset in the pattern refers to, so
   * NFKD is off in this mode and the panel says so. These two lines are the
   * proof that it is off and the proof that it is on in the other mode.
   */
  it('reads the text unfolded, so three dots mean three characters', () => {
    assert.equal(findAll('a … b', '...').length, 1);
    assert.equal(findAll('a … b', '...', { regex: true }).length, 1);
    // The literal mode found the ellipsis; the regex mode found `a … ` —
    // three characters, not the ellipsis. Same count, different answer, and
    // the text is what says which.
    assert.equal(findAll('a … b', '...')[0]!.from, 2);
    assert.equal(findAll('a … b', '...', { regex: true })[0]!.from, 0);
  });

  it('answers in UTF-8 bytes for a regex too, on a walk of its own', () => {
    const text = 'שלום a12';
    const [hit] = findAll(text, '[0-9]+', { regex: true });
    assert.equal(hit!.from, 6);
    assert.equal(hit!.byteFrom, utf8('שלום a'));
    assert.equal(hit!.byteTo, utf8('שלום a12'));
  });

  it('skips a zero-length match instead of looping on it for ever', () => {
    // `b*` matches the empty string at every position and does not advance
    // `lastIndex`. Deleting the guard hangs this test rather than reddening
    // it, which is said here so a future reader knows what a hang means.
    assert.deepEqual(findAll('aaa', 'b*', { regex: true }), []);
    assert.equal(findAll('aXbXc', 'X*', { regex: true }).length, 2);
  });

  it('says a bad pattern is bad, in the engine\'s own words', () => {
    const asked = findQuery('[', { regex: true });
    assert.equal(asked.ok, false);
    assert.equal(asked.slow, false);
    assert.match(String(asked.error), /Unterminated character class/);
  });

  it('falls back off the u flag rather than refusing the pattern', () => {
    // `a{` is a syntax error under `u` and a literal brace without it.
    const withU = findQuery('[a-z]+', { regex: true });
    assert.equal(withU.unicode, true);
    const without = findQuery('a{', { regex: true });
    assert.equal(without.ok, true);
    assert.equal(without.unicode, false, 'the fallback is what makes this pattern usable at all');
  });

  it('applies whole word to a regex by the matched text, not by the pattern', () => {
    assert.equal(findAll('cat category', 'ca.', { regex: true }).length, 2);
    assert.equal(findAll('cat category', 'ca.', { regex: true, wholeWord: true }).length, 1);
  });

  it('bounds a whole-word regex answer AFTER filtering, not before', () => {
    // Three whole words and three that are not, interleaved. A build that
    // bounded before filtering would answer fewer than two.
    const text = 'aa aab aa aab aa aab';
    assert.equal(findAll(text, 'aa', { regex: true, wholeWord: true }).length, 3);
    assert.equal(findAll(text, 'aa', { regex: true, wholeWord: true, }, 2).length, 2);
  });

  it('an empty query is not an error, and an error is not an empty query', () => {
    const empty = findQuery('', { regex: true });
    assert.equal(empty.ok, false);
    assert.equal(empty.error, null);
    assert.equal(empty.slow, false);
    const broken = findQuery('(', { regex: true });
    assert.equal(broken.ok, false);
    assert.notEqual(broken.error, null);
  });

  it('every option off is the find that shipped, argument for argument', () => {
    const asked = findQuery('...', {});
    assert.equal(asked.ok, true);
    assert.deepEqual(asked.find!('a … b'), foldedMatches('a … b', '...'));
    assert.deepEqual(asked.find!('a … b … c', 1), foldedMatches('a … b … c', '...', 1));
  });
});

/**
 * **THE `(X+)+` REFUSAL, AND THE 108,785 ms THAT BOUGHT IT.**
 *
 * Typed into the panel against this repository's own 139 MB session on
 * 2026-09-16, with the between-span time budget already in place:
 * `^(\w+\s?)+$` took **108,785 ms** and reported `timedOut`. The budget is
 * checked BETWEEN spans and the freeze is INSIDE one, in V8's regex engine,
 * which has no backtrack limit and cannot be interrupted from JavaScript.
 *
 * A runtime canary was written first and measured to be unsound — `(a*)*b`
 * does not return on twelve characters, so a canary long enough to learn
 * anything is long enough to hang. The check is therefore static.
 *
 * **These assertions are the refusal's boundary, and the allow list is the
 * more valuable half:** a check that refused everything would pass every
 * "is it refused" line below and destroy the feature.
 */
describe('a pattern that repeats a repeat is refused before it is run', () => {
  const REFUSED = [
    String.raw`^(\w+\s?)+$`, String.raw`(a+)+b`, String.raw`(a*)*b`,
    String.raw`(x+x+)+y`, String.raw`(?:\w+\s*)+!`, String.raw`(\d+){2,}`,
  ];
  const ALLOWED = [
    'byte offset', '[a-z]+ing', String.raw`\bbyte\s+offset\b`,
    String.raw`[\w.-]+@[\w.-]+`, '^.*$', String.raw`(\d{4})-(\d{2})-(\d{2})`,
    String.raw`(foo|bar)+`, String.raw`(ab)+`, String.raw`[+*]+`,
    String.raw`\(\w+\)+`, String.raw`(\w{1,3})+`, String.raw`(a)*`,
    // Added after a removal proof: `[+*]+` classifies the same with and
    // without class tracking, so it proved nothing. Here the `+` is inside a
    // class INSIDE a repeated group, which is the only shape where reading
    // the class as syntax flips the answer.
    String.raw`(a[+]b)+`,
    // And a group repeated a BOUNDED number of times, which is the other
    // half of the `{n,}` / `{n,m}` distinction and had no fixture either.
    String.raw`(\w+){1,3}`,
  ];

  it('refuses the shape that froze the scan, and says so as its own answer', () => {
    for (const pattern of REFUSED) {
      const asked = findQuery(pattern, { regex: true });
      assert.equal(asked.ok, false, pattern);
      assert.equal(asked.slow, true, `${pattern} must be refused as SLOW`);
      // Not an error. The pattern is legal and another engine would run it.
      assert.equal(asked.error, null, pattern);
    }
  });

  it('and runs everything else, which is what keeps the refusal narrow', () => {
    for (const pattern of ALLOWED) {
      const asked = findQuery(pattern, { regex: true });
      assert.equal(asked.ok, true, `${pattern} was refused and should not be`);
      assert.equal(asked.slow, false, pattern);
    }
  });

  it('reads a class and an escape as literals, not as quantifiers', () => {
    // `[+*]+` is a class of two literal characters, repeated once. A scanner
    // that did not track `[` would see `+` inside a group and refuse it.
    assert.equal(nestedQuantifier(String.raw`[+*]+`), false);
    // `\(` is a literal parenthesis. A scanner that did not track `\` would
    // push a group here and never pop it.
    assert.equal(nestedQuantifier(String.raw`\(\w+\)+`), false);
    // And the bounded/unbounded distinction, both directions on one shape.
    assert.equal(nestedQuantifier(String.raw`(\w{1,3})+`), false);
    assert.equal(nestedQuantifier(String.raw`(\w{1,})+`), true);
    // The same distinction on the OUTER repeat, which had no fixture until a
    // removal proof reddened nothing: `{1,3}` copies of a repeat is bounded
    // backtracking, `{1,}` copies is not.
    assert.equal(nestedQuantifier(String.raw`(\w+){1,3}`), false);
    assert.equal(nestedQuantifier(String.raw`(\w+){1,}`), true);
    // A quantifier inside a class is two literal characters, not a repeat.
    assert.equal(nestedQuantifier(String.raw`(a[+]b)+`), false);
  });
});
