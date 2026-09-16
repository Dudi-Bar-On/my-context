// @basis TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you,
// TASK-the-find-panel-offers-regular-expressions-and-no-help-and,
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
  /** `semantic/11`: a CODE for a query the mode could not read. Never a sentence. */
  why: string | null;
  mode: string;
  regex: boolean;
  unicode: boolean;
  find?: (text: string, limit?: number) => Hit[];
}
interface Options {
  mode?: string; caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean;
}
const {
  foldedMatches, foldedHolds, findQuery, nestedQuantifier, MODES, NEAR_CHARS, NEAR_MAX,
} = (await import(FOLD)) as {
  foldedMatches: (text: string, query: string, limit?: number) => Hit[];
  foldedHolds: (text: string, query: string) => boolean;
  findQuery: (query: string, options?: Options) => Asked;
  nestedQuantifier: (source: string) => boolean;
  MODES: string[];
  NEAR_CHARS: number;
  NEAR_MAX: number;
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


/**
 * **WILDCARDS** — `semantic/11`,
 * `TASK-the-find-panel-offers-regular-expressions-and-no-help-and`, and the
 * owner's own words: *"alternatives to regex A - wildcard character pattern
 * matching in expressions"*.
 *
 * ── THE ONE THING TO HOLD, BECAUSE IT IS THE WHOLE ARGUMENT FOR THE MODE ──
 *
 * **A wildcard FOLDS and a regular expression does not.** The obvious build
 * translates `*` to `.*` and hands it to `RegExp`, and a regular expression
 * reads the text as written — so a mode advertised as *the simple one* would
 * quietly find LESS than the plain mode it is offered as an alternative to.
 * The assertion that holds it is `b*t...` reaching `byte…`, below, and it is
 * the one that reddens if anyone ever reaches for the translation.
 *
 * The second half is a consequence: because there is no `RegExp` in the path,
 * a wildcard cannot be the `(X+)+` shape and the refusal cannot fire in this
 * mode. That is asserted too — and measured on the live session, where the
 * worst wildcard this lane could construct, `a*a*a*a*a*a`, cost 389 ms over
 * 4,615 spans against `(X+)+`'s 108,785 ms inside ONE.
 */
describe('wildcards are stitched from folded pieces, not compiled to a pattern', () => {
  const wild = (text: string, query: string, options: Options = {}, limit?: number): Hit[] =>
    findAll(text, query, { ...options, mode: 'wildcard' }, limit);
  const said = (text: string, query: string, options: Options = {}): string[] =>
    wild(text, query, options).map((h) => text.slice(h.from, h.to));

  it('`*` is any run and `?` is exactly one character', () => {
    assert.deepEqual(said('byte offset and budget', 'b*t'), ['byt', 'budget']);
    assert.deepEqual(said('byte and byte offsets', 'by?e'), ['byte', 'byte']);
    // `?` is a CODE POINT and not a UTF-16 unit, which is the difference
    // between matching one emoji and matching half of one.
    assert.deepEqual(said('a\u{1F600}b', 'a?b'), ['a\u{1F600}b']);
  });

  it('THE PIECES FOLD, which is the whole reason this is not a regular expression',
    () => {
      // Three dots reach the `…` this product writes 3,062 times, THROUGH a
      // wildcard. A translation to `.*`/`.` would answer nothing here, because
      // a pattern reads the text exactly as written.
      assert.deepEqual(said('the byte… here', 'b*e...'), ['byte…']);
      assert.deepEqual(said('a … b', '...'), ['…']);
    });

  it('a wildcard can never be refused for its shape, because no pattern is built', () => {
    // The shape the regular-expression mode refuses, written with stars.
    for (const query of ['*a*a*a*a*a*', 'a*b*c*d*e*f*g', '?*?*?*?*']) {
      const asked = findQuery(query, { mode: 'wildcard' });
      assert.equal(asked.ok, true, `${query} was refused and cannot be`);
      assert.equal(asked.slow, false, query);
      assert.equal(asked.error, null, query);
    }
    // And the parentheses and plus signs that MAKE that shape are literal
    // characters here, so a reader cannot smuggle one in.
    assert.deepEqual(said('x (a+)+b y', '(a+)+b'), ['(a+)+b']);
  });

  it('a leading or trailing `*` paints nothing, and a `?` at an end paints one', () => {
    // Unanchored, so a star at either end asks for text that is already
    // allowed to be there. `*byte*` and `byte` are the same answer.
    assert.deepEqual(said('a byte here', '*byte*'), ['byte']);
    assert.deepEqual(said('a byte here', 'byte'), ['byte']);
    // A `?` is different: it REQUIRES a character and paints it.
    assert.deepEqual(said('a byte here', '?byte'), [' byte']);
    assert.deepEqual(said('byte here', '?byte'), []);
  });

  it('an exact gap is exact, and an open gap is a floor', () => {
    assert.deepEqual(said('ab acb axxb', 'a?b'), ['acb']);
    assert.deepEqual(said('ab acb axxb', 'a??b'), ['axxb']);
    assert.deepEqual(said('ab acb', 'a*b'), ['ab', 'acb']);
    // **AND A LEADING `?` KEEPS THE MATCHES FROM OVERLAPPING.** `ab` occurs at
    // 1 and at 3 in `aabab`; the first match runs 0..3, so the second would
    // start at 2 and sit inside it. A build that checked the floor against the
    // PIECE rather than against the range's own start emits both.
    assert.deepEqual(said('aabab', '?ab'), ['aab']);
    // `?*` is "at least one, then any run", which is a floor and not a pin —
    // so from the `a` at 0 the nearest `b` that is at least one character
    // along is the one in `acb`, and the match spans what lies between.
    assert.deepEqual(said('ab acb axxb', 'a?*b'), ['ab acb', 'axxb']);
  });

  it('a pattern with no literal at all is answered rather than refused', () => {
    // `*` alone is the whole turn; `???` is every window of three characters,
    // which is what regex `.{3}` means and is the same honest answer.
    assert.deepEqual(said('abc', '*'), ['abc']);
    assert.deepEqual(said('abcdefg', '???'), ['abc', 'def']);
    assert.deepEqual(said('', '*'), []);
  });

  it('a backslash escapes the next character, and a lone one is a backslash', () => {
    assert.deepEqual(said('a*b acb', 'a\\*b'), ['a*b']);
    assert.deepEqual(said('a?b acb', 'a\\?b'), ['a?b']);
    // **A REMOVAL PROOF FOUND THIS.** A first draft refused a source with no
    // literal, no `*` and no `?` as `empty` — and the branch is unreachable,
    // because a lone `\` escapes nothing and stays a literal backslash. It
    // answers 410 turns on this repository's own session, so it is a real
    // query and the guard was deleted rather than left unrunnable.
    assert.deepEqual(said('a \\ b', '\\'), ['\\']);
  });

  it('Match case and Whole word mean here exactly what they mean in the plain mode', () => {
    assert.deepEqual(said('Byte byte', 'b*e', { caseSensitive: true }), ['byte']);
    assert.deepEqual(said('Byte byte', 'b*e'), ['Byte', 'byte']);
    // Whole word is applied to the WHOLE stitched match, at both of its ends.
    assert.deepEqual(said('cat category', 'ca?', { wholeWord: true }), ['cat']);
  });

  it('bounds the answer, and a rejected hit does not consume the text under it', () => {
    assert.equal(wild('a1 a2 a3 a4', 'a?', {}, 2).length, 2);
    // `ba-a-a `: the occurrence at 1 is glued to a `b` and refused; the one at
    // 3 OVERLAPS it and IS a whole word, because a hyphen is not a word
    // character. A build that emptied its list on a REJECTED hit loses it.
    assert.deepEqual(said('ba-a-a ', 'a?a', { wholeWord: true }), ['a-a']);
  });

  it('the byte offsets are UTF-8 and are taken on one walk', () => {
    const text = 'a…b byte';
    const [hit] = wild(text, 'b*e');
    assert.ok(hit);
    assert.equal(hit.byteFrom, utf8(text.slice(0, hit.from)));
    assert.equal(hit.byteTo, utf8(text.slice(0, hit.to)));
  });
});

/**
 * **THE LOGICAL OPERATORS, AND WHAT A HIT IS UNDER THEM** — `semantic/11`.
 *
 * He named `AND OR LIKE NEAR` and guessed they would come from SQLite. They do
 * not: this surface has no index and never touches one. The consequence the
 * assertions below pin is the good half of that — an operator implemented in
 * the scan composes with Match case and with NFKD folding, and an FTS5
 * operator would compose with neither.
 *
 * ── THE HARD QUESTION THE ITEM POSES, ANSWERED IN ASSERTIONS ─────────────
 *
 * *"Under `AND` a TURN matches but no single range does. Decide and state:
 * does `AND` paint both terms wherever they occur, and does the count count
 * TURNS or OCCURRENCES?"*
 *
 * **Both terms are painted wherever they occur, and the two counts keep the
 * meanings they already had** — turns are turns, times are ranges painted.
 * They cannot come apart, because `findInDocument` counts turns as spans whose
 * range list is non-empty and times as the LENGTH of that list. The assertion
 * that holds it is the last one here, and it is the one that would redden if
 * anyone made `AND` return a single range or an empty one.
 */
describe('AND, OR, NOT and NEAR are implemented in the scan and say what a hit is', () => {
  const logic = (text: string, query: string, options: Options = {}, limit?: number): Hit[] =>
    findAll(text, query, { ...options, mode: 'logical' }, limit);
  const said = (text: string, query: string, options: Options = {}): string[] =>
    logic(text, query, options).map((h) => text.slice(h.from, h.to));
  const TEXT = 'the budget was 5000 ms and the offset was late';

  it('AND paints BOTH terms, and only in a turn that holds both', () => {
    assert.deepEqual(said(TEXT, 'budget AND offset'), ['budget', 'offset']);
    assert.deepEqual(said(TEXT, 'budget AND nowhere'), []);
    // Juxtaposition is AND, which is FTS5's own spelling and is what makes
    // `byte offset` in this mode two words rather than a phrase.
    assert.deepEqual(said(TEXT, 'budget offset'), ['budget', 'offset']);
    // And the phrase is available, in quotation marks.
    assert.deepEqual(said(TEXT, '"the budget"'), ['the budget']);
  });

  it('OR paints the side that is there, and never the side that is not', () => {
    assert.deepEqual(said(TEXT, 'budget OR nowhere'), ['budget']);
    assert.deepEqual(said(TEXT, 'nowhere OR offset'), ['offset']);
    assert.deepEqual(said(TEXT, 'budget OR offset'), ['budget', 'offset']);
    assert.deepEqual(said(TEXT, 'nowhere OR neither'), []);
  });

  it('NOT keeps the left and paints nothing for the right, because it is not there', () => {
    assert.deepEqual(said(TEXT, 'budget NOT nowhere'), ['budget']);
    assert.deepEqual(said(TEXT, 'budget NOT offset'), []);
  });

  it('NEAR is measured in CHARACTERS and paints only the pairs that are near', () => {
    // `budget` ends at 10 and `ms` begins at 20 — ten characters apart, which
    // is inside the default 30. `offset` is 25 characters past `ms`.
    assert.deepEqual(said(TEXT, 'budget NEAR ms'), ['budget', 'ms']);
    assert.deepEqual(said(TEXT, 'budget NEAR/4 ms'), []);
    /*
     * **A LONE OCCURRENCE TOO FAR FROM ANY PARTNER IS NOT PAINTED**, and this
     * is the assertion that separates NEAR from AND. `budget` at 0 is 200
     * characters from the nearest `ms`; the pair at the end of the span is
     * adjacent. AND paints all four occurrences; NEAR paints the three that
     * take part in a pair and leaves the first `budget` alone.
     */
    const far = `budget ${'x'.repeat(200)} ms and budget ms`;
    assert.deepEqual(logic(far, 'budget AND ms').map((h) => h.from), [0, 208, 215, 222]);
    assert.deepEqual(logic(far, 'budget NEAR ms').map((h) => h.from), [208, 215, 222]);
    assert.equal(NEAR_CHARS, 30,
      'the default NEAR distance is the archive search’s own 30, in the same unit');
    /*
     * **AND A CHARACTER IS A CODE POINT, WHICH NEEDED ITS OWN FIXTURE.** A
     * removal proof found that counting UTF-16 UNITS instead reddened only a
     * WILDCARD line: every NEAR fixture above is ASCII, where the two units
     * agree. Four astral characters are four characters and eight units, so
     * `NEAR/5` reaches across them and a build counting units does not.
     */
    const astral = `a${'\u{1F600}'.repeat(4)}b`;
    assert.deepEqual(said(astral, 'a NEAR/5 b'), ['a', 'b']);
    assert.deepEqual(said(astral, 'a NEAR/3 b'), []);
  });

  it('an operator is an operator only in CAPITALS', () => {
    // Which is what lets a reader look for the word `and` at all.
    assert.deepEqual(said('this and that', 'and'), ['and']);
    assert.deepEqual(said('this and that', 'this AND that'), ['this', 'that']);
  });

  it('brackets group, and OR binds looser than AND', () => {
    const text = 'alpha gamma';
    // Without brackets this is `alpha AND (beta OR gamma)` only if AND binds
    // tighter than OR, which it does: `alpha AND beta OR gamma` is
    // `(alpha AND beta) OR gamma`, and gamma alone satisfies it.
    assert.deepEqual(said(text, 'alpha AND beta OR gamma'), ['gamma']);
    assert.deepEqual(said(text, 'alpha AND (beta OR gamma)'), ['alpha', 'gamma']);
  });

  it('the terms fold and obey Match case and Whole word', () => {
    assert.deepEqual(said('a … b and dots', '... AND dots'), ['…', 'dots']);
    assert.deepEqual(said('Byte byte AND', 'Byte AND byte', { caseSensitive: true }),
      ['Byte', 'byte']);
    assert.deepEqual(said('cat category dog', 'cat AND dog', { wholeWord: true }),
      ['cat', 'dog']);
    assert.deepEqual(said('category dog', 'cat AND dog', { wholeWord: true }), []);
  });

  it('overlapping ranges from two terms are painted once, earliest first', () => {
    // A range can wear one highlight. `by` and `byte` under an OR overlap, so
    // the earlier one wins and the later is dropped rather than both painted.
    const hits = logic('byte', 'by OR byte');
    assert.deepEqual(hits.map((h) => [h.from, h.to]), [[0, 2]]);
  });

  it('LIKE is refused BY NAME, as the wildcard mode under another spelling', () => {
    const asked = findQuery('byte LIKE b%', { mode: 'logical' });
    assert.equal(asked.ok, false);
    assert.equal(asked.why, 'like');
    // Not an error and not a refusal for slowness: a third answer with its own
    // sentence, which the panel turns into "that is the Wildcards mode".
    assert.equal(asked.error, null);
    assert.equal(asked.slow, false);
  });

  it('a query the grammar cannot read answers a CODE, never a sentence', () => {
    // `fold.js` has no string table and must not grow one: the words have to
    // exist in two languages and this file runs in two runtimes.
    const why = (query: string): string | null =>
      findQuery(query, { mode: 'logical' }).why;
    assert.equal(why('byte AND'), 'operand');
    assert.equal(why('AND byte'), 'operand');
    assert.equal(why('"byte'), 'quote');
    assert.equal(why('(byte'), 'paren');
    assert.equal(why('byte)'), 'paren');
    assert.equal(why('""'), 'empty');
    assert.equal(why(`byte NEAR/${NEAR_MAX + 1} offset`), 'nearRange');
    assert.equal(why('byte NEAR/0 offset'), 'nearRange');
    // And a readable one says nothing at all.
    assert.equal(why('byte AND offset'), null);
  });

  it('THE TWO COUNTS CANNOT DISAGREE, because times IS the length of the list', () => {
    // The item: *"The panel already draws both numbers and they must not start
    // disagreeing."* `findInDocument` counts a turn when this list is
    // non-empty and counts times as `list.length`, so the invariant is a
    // property of this function: a matching span returns at least one range,
    // and a non-matching span returns exactly none.
    const spans = [TEXT, 'budget alone', 'offset alone', 'neither here'];
    const asked = findQuery('budget AND offset', { mode: 'logical' });
    assert.equal(asked.ok, true);
    const lists = spans.map((span) => asked.find!(span, 500));
    assert.deepEqual(lists.map((l) => l.length), [2, 0, 0, 0]);
    assert.equal(lists.filter((l) => l.length > 0).length, 1, 'turns');
    assert.equal(lists.reduce((n, l) => n + l.length, 0), 2, 'times');
  });
});

/**
 * **THE MODE IS ONE OF FOUR AND THE FOUR ARE EXCLUSIVE** — `semantic/11`.
 *
 * Notepad++, which the owner named, uses a RADIO GROUP for this and not four
 * checkboxes, and `MODES` is the list the panel's radios, the route's
 * parameter vocabulary and this dispatcher all read. What is asserted here is
 * the part a browser test cannot see: that the old spelling still works, so
 * `semantic/9`'s panel and every test written against it are unchanged.
 */
describe('the four ways of reading a query are exclusive and named once', () => {
  it('the list is the one both runtimes read', () => {
    assert.deepEqual(MODES, ['normal', 'wildcard', 'logical', 'regex']);
  });

  it('`regex: true` with no mode is still the regular-expression mode', () => {
    const asked = findQuery(String.raw`byte\s+offset`, { regex: true });
    assert.equal(asked.mode, 'regex');
    assert.equal(asked.regex, true);
    assert.deepEqual(asked.find!('byte  offset').map((h) => [h.from, h.to]), [[0, 12]]);
  });

  it('an unknown mode falls back to the plain one rather than to the last one set', () => {
    // The ROUTE refuses an unknown mode with a 400; this is the matcher's own
    // floor for a caller that is not the route. It must be `normal` and not
    // "whatever `regex` happens to say", because a page asking for a mode this
    // build does not have must not be answered as though it had asked for a
    // pattern.
    const asked = findQuery('byte offset', { mode: 'nonsense' });
    assert.equal(asked.mode, 'normal');
    assert.equal(asked.regex, false);
    assert.deepEqual(asked.find!('a byte offset b').map((h) => [h.from, h.to]), [[2, 13]]);
  });

  it('every mode answers the same shape, so nothing downstream branches on it', () => {
    for (const mode of MODES) {
      const asked = findQuery('byte', { mode });
      assert.equal(asked.ok, true, mode);
      assert.equal(asked.mode, mode);
      const hits = asked.find!('a byte b', 500);
      assert.deepEqual(hits.map((h) => [h.from, h.to, h.precise]), [[2, 6, true]], mode);
      assert.equal(hits[0]!.byteFrom, 2, mode);
      assert.equal(hits[0]!.byteTo, 6, mode);
    }
  });
});
