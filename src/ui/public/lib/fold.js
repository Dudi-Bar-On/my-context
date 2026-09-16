/**
 * **THE FOLDED MATCHER** — `semantic/8`,
 * `TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you`, owner
 * ruling 2026-09-16: *"3 write 40 lines of code - just verify it works the
 * same as the original code intended"*.
 *
 * ── WHAT IT IS FOR, MEASURED ──────────────────────────────────────────────
 *
 * This product writes `…` **3,062 times** and a reader types three dots. On
 * the archive as it stands (`reports/2026-09-16-search-adopt-or-build.md`
 * §2.3, taken against the live index and NOT re-derived here):
 *
 *     spans containing a literal "…"                752
 *     a reader types "..."  — FTS5 trigram          456
 *     a reader types "..."  — plain indexOf         456
 *     a reader types "..."  — NFKD-folded         1,012
 *
 * The same holds for the quotes, dashes and spaces a model emits and a
 * keyboard does not: `U+2011` x66, `U+2260` x47, `U+00B5` x8, `U+FF5C` x3.
 * **806 of 11,251 spans in the archive change under NFKD, and 376 of one
 * session's change LENGTH** — which is the whole difficulty and is answered
 * below rather than in a comment.
 *
 * ── WHY IT IS WRITTEN HERE AND NOT VENDORED ───────────────────────────────
 *
 * Lane AI costed `SearchCursor` from `@codemirror/search` (6.7.2, MIT, ~148
 * lines with the five `char.ts` helpers it needs) and recommended taking it.
 * **The owner chose to write it.** That is settled; `package.json` is not
 * touched and nothing here is a copy of anything.
 *
 * What IS taken from `SearchCursor` is its *intent*, because the owner asked
 * for that in as many words — and it was checked by RUNNING the upstream
 * algorithm beside this one rather than by reading it. That run is recorded
 * in `reports/2026-09-16-folding-and-highlight.md` §1.4 (24 of 24 synthetic
 * cases, and 11,364 real archive spans x 20 queries — 1,775,487 hits, zero
 * differences); its OUTPUT is the golden table in `test/ui/fold.test.ts`,
 * which is what this repository keeps, because keeping upstream's source to
 * compare against would mean vendoring a library the owner ruled out. What
 * that upstream does, read off `@codemirror/search@6.7.2`'s published
 * `dist/index.js`:
 *
 *   1. `basicNormalize = x => x.normalize("NFKD")`, applied to the query as a
 *      WHOLE STRING and to the text ONE CODE POINT AT A TIME.
 *   2. It walks the ORIGINAL text by code point and feeds each code point's
 *      normalised units, one unit at a time, into a machine that holds every
 *      partial match in flight at once.
 *   3. **The offsets are never mapped back, because they are never mapped
 *      away.** A partial match records the ORIGINAL offset it began at, and a
 *      completed match ends at the original offset just past the code point
 *      whose expansion finished it. There is no arithmetic to get wrong: the
 *      original position is carried along beside the normalised one.
 *   4. `precise` is `false` when the match begins or ends INSIDE a code point
 *      that expanded — the reported range is then a superset of what matched,
 *      and saying so is the difference between a wide highlight and a lie.
 *
 * Point 3 is the design, and it is why this is short. The obvious
 * implementation — normalise the whole string, `indexOf`, then walk back to
 * find the original offset — is the one that goes silently wrong on every
 * offset after the first folded character, and a wrong offset in this product
 * lands mid-record and reports `unreadable` rather than throwing.
 *
 * ── WHAT THIS DELIBERATELY DOES LESS OF, AND WHY IT CANNOT ARISE HERE ─────
 *
 *   — **No rope.** `SearchCursor` reads through `text.iterRange(from, to)`
 *     because CodeMirror's document is a 583-line `Text` rope. Here a span IS
 *     a JavaScript string — `conversation_prose.text` on the server, a text
 *     node's `data` in the browser — so the iterator would be a one-element
 *     loop around what is already in hand.
 *   — **No `nextOverlapping`.** A find bar paints non-overlapping hits;
 *     upstream's own `next()` drops overlaps for the same reason.
 *
 * **TWO ROWS OF THAT TABLE WERE REVERSED ON 2026-09-16 BY THE OWNER, and they
 * are rewritten here rather than left standing beside a file that no longer
 * obeys them** — a copy of a superseded rule is the defect this project
 * measures. What they said, and what is true now:
 *
 *   — *"No `test` callback — upstream uses it for whole-word search … a word
 *     boundary here would be a rule nobody could state."* **A rule is stated
 *     now**, in `wholeWordAt` below: `\p{L}\p{N}_`, required only at an end
 *     that is itself a word character. What the old row was right about is
 *     kept and moved to the SCREEN instead of being used to refuse the
 *     control — in Hebrew the rule excludes the glued front particle, so
 *     `שורה` with Whole word on no longer finds `השורה`, and the panel says
 *     so with the number.
 *   — *"No `RegExpCursor` … §6 already refused regex on the stronger ground
 *     that it cannot use the index."* **Still no `RegExpCursor`** — it needs
 *     the rope (`lineAt`, `slice`, `charCodeAt`, `iter.lineBreak`) that a
 *     plain JavaScript string here is not. The regex support below is
 *     `RegExp` itself over the span, in `regexMatches`. And §6's ground is
 *     unchanged and still holds for the surface it was about: regex cannot
 *     use the FTS5 index, so it is not offered on the conversations LIST,
 *     only on this document scan, which never used the index either.
 *
 * ── AND IT ANSWERS IN BYTES AS WELL AS IN CHARACTERS ──────────────────────
 *
 * `SearchCursor` answers in **UTF-16 code units** and this project's currency
 * is **UTF-8 bytes** — every anchor, every `byteOffset`, every seek. They
 * genuinely differ: 53,268 bytes over one session's 4,394 spans, one span
 * diverging by 943. So the byte offset is accumulated on the SAME walk rather
 * than converted afterwards by a second pass that could disagree with the
 * first. `test/ui/fold.test.ts` pins `byteFrom` against `TextEncoder` — which
 * is the definition rather than a second opinion — and the same invariant was
 * checked on every one of those 1,775,487 archive hits during the comparison
 * run, with zero mismatches.
 *
 * ── ONE SPELLING, TWO RUNTIMES ────────────────────────────────────────────
 *
 * Plain JavaScript, no DOM, no string table, no import. The browser imports
 * it directly and `core/conversation-search.ts` loads it with a top-level
 * `await import()`, exactly as `ui/execute-catalogue.ts` loads
 * `public/lib/palette-defs.js` and for the same reason — so the function
 * stays SYNCHRONOUS. A count computed on the server and a highlight painted
 * in the browser by two different matchers would disagree about what a hit
 * is, and nothing on the screen would say which one was right.
 */

/**
 * NFKD, then case — the composition `SearchCursor` builds when it is given a
 * `normalize` option: `x => normalize(basicNormalize(x))`.
 *
 * **Case is folded because the index folds it.** `"BYTE OFFSET"` matches the
 * same 98 spans as `"byte offset"` on this trigram index
 * (`reports/2026-09-16-the-search-grammar.md` §2), and
 * `read-model-conversations.ts`' `passageAt` already locates
 * case-insensitively for that exact reason. A find that folded `…` but not
 * case would answer a different question from the search above it.
 *
 * ── AND `keepCase` IS THE SECOND AXIS, NOT A SECOND MATCHER ───────────────
 *
 * `semantic/9`, the owner's Find panel. **NFKD folding and case folding are
 * two axes and the whole reason this takes a flag rather than a branch is
 * that they must not be conflated.** Turning case sensitivity ON does NOT
 * turn NFKD off: a reader who ticks "Match case" is saying `Byte` is not
 * `byte`, and is saying nothing whatever about whether `…` is three dots. The
 * composition order is upstream's and is unchanged — NFKD first, case second,
 * and `keepCase` removes only the second step.
 */
function fold(text, keepCase) {
  const nfkd = text.normalize('NFKD');
  return keepCase === true ? nfkd : nfkd.toLowerCase();
}

/** UTF-8 length of one code point. The four ranges, written out. */
function utf8Len(code) {
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

/**
 * Feed one normalised code unit to every partial match in flight.
 *
 * This is `SearchCursor.match`, and the list is the whole trick: a query may
 * begin again inside itself (`aab` inside `aaab`), so every position that
 * could still become a match is kept, each carrying the ORIGINAL offset it
 * began at. A partial the unit does not continue is dropped where it stands.
 *
 * Returns the completed match, or `null`.
 */
function feed(partials, query, unit, at, atByte, atPrecise, end, endByte, endPrecise) {
  let hit = null;
  for (let i = 0; i < partials.length;) {
    const partial = partials[i];
    let keep = false;
    if (query.charCodeAt(partial.index) === unit) {
      if (partial.index === query.length - 1) {
        hit = {
          from: partial.from,
          to: end,
          byteFrom: partial.byteFrom,
          byteTo: endByte,
          precise: endPrecise && partial.precise,
        };
      } else {
        partial.index += 1;
        keep = true;
      }
    }
    if (keep) i += 1; else partials.splice(i, 1);
  }
  if (query.charCodeAt(0) === unit) {
    if (query.length === 1) {
      hit = {
        from: at, to: end, byteFrom: atByte, byteTo: endByte, precise: atPrecise && endPrecise,
      };
    } else {
      partials.push({ from: at, byteFrom: atByte, index: 1, precise: atPrecise });
    }
  }
  return hit;
}

/**
 * **Every place `query` occurs in `text`, folded, in document order.**
 *
 * Each hit is `{ from, to, byteFrom, byteTo, precise }`:
 *
 *   — `from` / `to` are **UTF-16 code unit** offsets into `text`, which is
 *     what a browser `Range` takes and therefore what a highlight needs.
 *   — `byteFrom` / `byteTo` are **UTF-8 byte** offsets into `text`, which is
 *     what every anchor, seek and `byteOffset` in this project is in.
 *   — `precise` is `false` when the range covers more than what matched,
 *     because the match began or ended inside a character that expanded —
 *     typing `..` finds `…` and the range is the whole ellipsis. A wide
 *     highlight that says it is wide is not a silent drop; one that does not
 *     is (`INV-nothing-is-dropped-silently`).
 *
 * `limit` bounds the answer. It is a real bound and callers disclose it: a
 * one-letter query over a 5.6 MB session has 62,767 hits
 * (`reports/2026-09-16-search-adopt-or-build.md` §2.3) and no reader wants
 * them, but nothing here decides that silently on their behalf.
 *
 * `keepCase` and `accept` are `semantic/9`'s two options, and the default of
 * each is the behaviour that shipped: `keepCase === false` folds case as it
 * always did, and `accept === null` takes every hit. **Callers do not pass
 * them** — `findQuery` at the foot of this file is the entry point that turns
 * an options bag into these two arguments, once, so that the browser and the
 * server cannot read a tick box differently.
 */
export function foldedMatches(
  text, query, limit = Number.POSITIVE_INFINITY, keepCase = false, accept = null,
) {
  const out = [];
  const folded = fold(query, keepCase);
  /*
   * **A FAST PATH AND NOT A CORRECTNESS GATE**, and that is said because a
   * removal proof found it: deleting `folded === ''` here reddens NOTHING.
   * An empty query gives `query.charCodeAt(0) === NaN`, which no unit can
   * equal, so the machine below already answers `[]` — the line saves a walk
   * of the whole text and nothing else. Recorded rather than dressed up as a
   * covered assertion; the BEHAVIOUR is pinned in `test/ui/fold.test.ts`, and
   * it is pinned to the machine rather than to this line.
   */
  if (folded === '' || text === '' || limit <= 0) return out;
  const partials = [];
  let pos = 0;
  let byte = 0;
  while (pos < text.length) {
    const code = text.codePointAt(pos);
    /*
     * **THE ASCII PATH, AND IT IS A MEASUREMENT RATHER THAN A HUNCH.**
     *
     * The general path allocates two strings per character —
     * `String.fromCodePoint` and `fold` — and this archive's largest session
     * is 13,206,532 characters. Measured on it, 2026-09-16: a whole-session
     * scan for `...` cost **717 ms** without this line and **116 ms** with
     * it, and the answers are identical.
     *
     * It is safe because it is exhaustive rather than typical: **every code
     * point below U+0080 is NFKD-stable**, and `toLowerCase` over that range
     * is exactly `A`-`Z` plus 32. `test/ui/fold.test.ts` asserts that for all
     * 128 of them against `fold` itself rather than trusting this sentence,
     * and the corpus comparison against `SearchCursor` is re-run with the
     * path in place. `norm.length` is then 1, so both `precise` flags are
     * true and there is no expansion to walk.
     */
    if (code < 0x80) {
      const end = pos + 1;
      const endByte = byte + 1;
      const hit = feed(
        partials, folded,
        !keepCase && code >= 0x41 && code <= 0x5a ? code + 0x20 : code,
        pos, byte, true, end, endByte, true,
      );
      // **A REJECTED HIT DOES NOT EMPTY THE PARTIAL LIST, and that asymmetry
      // is the whole of what `accept` costs.** A hit that is TAKEN consumes
      // the text under it, so every partial still in flight overlaps it and
      // upstream drops them. A hit the caller REFUSES — `wholeWord` saying
      // this occurrence is glued to a letter — consumed nothing, so a later
      // match that began inside it is still a match a reader wants.
      if (hit !== null && (accept === null || accept(text, hit))) {
        out.push(hit);
        partials.length = 0;
        if (out.length >= limit) return out;
      }
      pos = end;
      byte = endByte;
      continue;
    }
    const raw = String.fromCodePoint(code);
    const norm = fold(raw, keepCase);
    const end = pos + raw.length;
    const endByte = byte + utf8Len(code);
    let at = pos;
    let atByte = byte;
    let atPrecise = true;
    for (let i = 0; i < norm.length; i += 1) {
      const hit = feed(
        partials, folded, norm.charCodeAt(i),
        at, atByte, atPrecise, end, endByte, i === norm.length - 1,
      );
      if (hit !== null && (accept === null || accept(text, hit))) {
        out.push(hit);
        // `SearchCursor.next` empties the partial list for the same reason: a
        // hit that overlaps the one just returned is not a second hit.
        partials.length = 0;
        if (out.length >= limit) return out;
        break;
      }
      if (i === norm.length - 1) break;
      /*
       * **WALKING INSIDE ONE CHARACTER'S EXPANSION** — `SearchCursor`'s
       * `pos++`, and the one place the two currencies part company.
       *
       * The original offset may follow the normalised one only while the
       * expansion still IS the original, which happens for an astral
       * character whose NFKD is itself: its two UTF-16 units are its own
       * surrogate pair. `at` follows it, because `from` is a code-unit offset
       * and that is what upstream answers.
       *
       * **`atByte` does NOT, and that is not an omission.** Half of a
       * surrogate pair is half of a four-byte UTF-8 sequence; there is no
       * byte offset at that position to report, and inventing one is exactly
       * the silent mid-record landing this task was filed about. The byte
       * offset stays on the character's own boundary and the match is marked
       * imprecise, which is the honest pair of answers.
       *
       * It is reachable only by a query whose FIRST unit is a lone low
       * surrogate — half a character, which no text input can produce. It is
       * written out rather than dropped so that this function and the
       * upstream one agree on inputs a fixture can construct even though a
       * reader cannot type them.
       */
      if (atPrecise && i < raw.length && raw.charCodeAt(i) === norm.charCodeAt(i)) {
        const unit = norm.charCodeAt(i);
        at += 1;
        if (unit < 0xd800 || unit > 0xdfff) atByte += utf8Len(unit);
        else atPrecise = false;
      } else {
        atPrecise = false;
      }
    }
    pos = end;
    byte = endByte;
  }
  return out;
}

/**
 * Does `text` hold `query` at all — the same question, stopped at the first
 * answer.
 *
 * A separate entry point rather than `foldedMatches(...).length > 0` because
 * the server asks it of every prose span in a session, and on a common word
 * the difference is the whole cost: one hit instead of 62,767.
 */
export function foldedHolds(text, query) {
  return foldedMatches(text, query, 1).length > 0;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * **THE THREE OPTIONS THE OWNER ASKED FOR TWICE** — `semantic/9`,
 * `TASK-the-find-options-the-owner-asked-for-twice-in-a-floating`.
 *
 * *"there are many options there including lower case, upper case, whole word,
 * regex and much more"* — 2026-09-16, his second ask, after the first did not
 * arrive.
 *
 * ── WHY THEY LIVE HERE, WHICH IS THE ONLY PLACE THEY CAN ─────────────────
 *
 * `reports/2026-09-16-the-search-grammar.md` §6 refused all three, and its
 * refusals are CORRECT ABOUT THE SURFACE THEY WERE WRITTEN ABOUT and wrong
 * about this one. Every one of them is an argument about **the FTS5 trigram
 * index** behind `searchArchive`:
 *
 *   — *"Regular expressions … cannot use the index at all"* — true, and the
 *     find bar does not use the index. `findInDocument` is already a
 *     JavaScript SCAN of every prose span, measured at ~160 ms, precisely
 *     because a trigram index cannot answer "where in this document".
 *   — *"whole word … would have to be a post-filter in JS over every hit"* —
 *     true, and a post-filter over a scan that is already running is the
 *     cheapest thing in this file. The §6 objection is that it is expensive
 *     over an INDEX query, which returns rows it did not read.
 *   — *"Making [case] optional would mean a second index or a post-filter"* —
 *     the same sentence, and again there is no index here to double.
 *
 * So the three options are implemented **in the scan**, which is the item's
 * own instruction and the reason it is an instruction: an option implemented
 * in the page would apply to the rows the virtualiser happens to have drawn,
 * which is the defect this whole product exists to refuse.
 *
 * **What §6 is still right about, and is recorded rather than quietly
 * dropped:** none of this reaches `searchArchive`, the box on the
 * conversations LIST that does use the index. Those three refusals stand
 * there unchanged, and this file is not imported by it.
 *
 * ── AND WHAT EACH ONE COSTS A READER WHO TICKS IT ────────────────────────
 *
 * Every one of them changes the ANSWER, not just the query, so each is drawn
 * with the sentence that says how. `screens/conversations.js` draws them;
 * this file is where the semantics are decided, once, for both runtimes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * What counts as being INSIDE a word, for `wholeWord`.
 *
 * `\p{L}\p{N}_` and not `\w`: `\w` is `[A-Za-z0-9_]`, so every Hebrew letter
 * in this archive is a non-word character to it and "whole word" would report
 * that every Hebrew word in the corpus is already whole. Half this corpus is
 * Hebrew, so that is not an edge case, it is the common one.
 */
const WORD = /[\p{L}\p{N}_]/u;

/** Is the code point starting at `i` a word character? `false` past the end. */
function wordAt(text, i) {
  const code = text.codePointAt(i);
  return code === undefined ? false : WORD.test(String.fromCodePoint(code));
}

/**
 * Is the code point ENDING at `i` a word character? `false` at the start.
 *
 * A surrogate pair is stepped back over as one character rather than read as
 * its low half: `charCodeAt(i-1)` on an astral character answers a lone
 * surrogate, which `\p{L}` matches for no language at all.
 */
function wordBefore(text, i) {
  if (i <= 0) return false;
  const low = text.charCodeAt(i - 1);
  const at = (low >= 0xdc00 && low <= 0xdfff && i >= 2
    && text.charCodeAt(i - 2) >= 0xd800 && text.charCodeAt(i - 2) <= 0xdbff) ? i - 2 : i - 1;
  return wordAt(text, at);
}

/**
 * **IS THIS OCCURRENCE A WHOLE WORD**, and the rule is `\b`'s rather than
 * "the query is surrounded by spaces".
 *
 * The boundary is required only at an END THAT IS ITSELF A WORD CHARACTER.
 * That is not a nicety: without it, a reader who ticks Whole word and then
 * types `...` gets zero hits for ever, because the character before `…` is a
 * letter and `.` is not a word character — the option would silently break
 * the one query `semantic/8` was built for. Same for `-word`, `=`, `|`.
 *
 * It is tested on THIS text — the original, not the folded form — because
 * that is the string the reader is looking at and the only one whose
 * neighbours mean anything. The match's own first and last characters decide
 * whether each end is checked, so the rule is identical for a literal query
 * and for a regular expression, which have no query text in common.
 */
function wholeWordAt(text, hit) {
  if (wordAt(text, hit.from) && wordBefore(text, hit.from)) return false;
  if (wordBefore(text, hit.to) && wordAt(text, hit.to)) return false;
  return true;
}

/**
 * The UTF-8 byte offsets of a list of character ranges, filled in by ONE walk.
 *
 * The literal matcher accumulates bytes on the same walk it matches on, which
 * is `semantic/8`'s design and the reason it has no arithmetic to get wrong. A
 * `RegExp` cannot: it answers in UTF-16 indices and nothing else. So the walk
 * happens here instead — still once over the text, still by code point, still
 * `utf8Len` and never `TextEncoder` on a slice, which would be a second
 * opinion about where a character begins.
 *
 * Only ever called when there is at least one match, so a span with nothing in
 * it costs the regex engine's pass and no more.
 *
 * **An edge INSIDE a surrogate pair snaps FORWARD to the character's own
 * boundary**, which a non-`u` pattern can produce and `u` cannot. There is no
 * byte offset half way through a four-byte sequence to report, so the choice
 * is between a boundary and an invention; `precise` is `false` on any hit
 * whose edge had to move, which is the same bargain the folded matcher makes
 * for a range that covers more than what matched.
 */
function bytesFor(text, hits) {
  let pos = 0;
  let byte = 0;
  let next = 0;
  const edges = [];
  // `from` and `to` are already ascending across non-overlapping matches in
  // document order, which is what `RegExp` with `g` produces.
  for (const hit of hits) edges.push(hit.from, hit.to);
  while (next < edges.length) {
    if (edges[next] <= pos || pos >= text.length) { edges[next] = byte; next += 1; continue; }
    const code = text.codePointAt(pos);
    byte += utf8Len(code);
    pos += code >= 0x10000 ? 2 : 1;
  }
  for (let i = 0; i < hits.length; i += 1) {
    hits[i].byteFrom = edges[i * 2];
    hits[i].byteTo = edges[i * 2 + 1];
  }
  return hits;
}

/** Does index `i` fall between the two halves of one surrogate pair? */
function splitsPair(text, i) {
  if (i <= 0 || i >= text.length) return false;
  const high = text.charCodeAt(i - 1);
  const low = text.charCodeAt(i);
  return high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff;
}

/**
 * **EVERY PLACE A REGULAR EXPRESSION MATCHES `text`.**
 *
 * ── IT READS THE ORIGINAL TEXT, NOT THE FOLDED FORM, AND THAT IS SAID ON
 *    THE SCREEN ─────────────────────────────────────────────────────────────
 *
 * The literal matcher folds NFKD so that a reader typing `...` finds the `…`
 * this product writes 3,062 times. A regular expression cannot: `...` in
 * regex means *any three characters*, `\.` means a literal dot, and folding
 * the text under a pattern would change what every one of the pattern's own
 * offsets refers to. So regex mode searches the text AS WRITTEN, the NFKD
 * expansion is off, and `conv.find.reFold` says so beside the toggle rather
 * than leaving a reader to discover that one mode finds `…` and the other
 * does not.
 *
 * `precise` is therefore `true` on every hit whose ends are real character
 * boundaries — nothing expanded, so the range is exactly what matched — and
 * `false` on the one case a non-`u` pattern can produce, an end between the
 * two halves of a surrogate pair. See `bytesFor`.
 *
 * ── ZERO-LENGTH MATCHES ARE SKIPPED AND `lastIndex` IS ADVANCED BY HAND ───
 *
 * `/a*​/g` matches the empty string at every position. Painting a collapsed
 * range is painting nothing, and a `g` regex whose match is empty does not
 * advance `lastIndex`, so the obvious loop never terminates. Both are handled
 * in the same two lines.
 */
function regexMatches(re, text, limit, accept) {
  const out = [];
  re.lastIndex = 0;
  let found = re.exec(text);
  while (found !== null) {
    const from = found.index;
    const to = from + found[0].length;
    if (to === from) {
      re.lastIndex = from + 1;
      if (re.lastIndex > text.length) break;
    } else {
      const hit = {
        from,
        to,
        byteFrom: 0,
        byteTo: 0,
        precise: !splitsPair(text, from) && !splitsPair(text, to),
      };
      /*
       * **`accept` IS APPLIED HERE AND NOT BY THE CALLER, so that `limit`
       * bounds the KEPT hits.** Filtering afterwards would mean collecting
       * every occurrence first: `\w+` with Whole word on, over a 900 KB turn
       * of terminal output, is tens of thousands of objects built to keep
       * five hundred. The bound is on the answer either way; this is where it
       * costs nothing.
       */
      if (accept === null || accept(text, hit)) {
        out.push(hit);
        if (out.length >= limit) break;
      }
      re.lastIndex = to;
    }
    found = re.exec(text);
  }
  return out.length === 0 ? out : bytesFor(text, out);
}

/**
 * **THE FLAGS, AND WHY `u` IS TRIED AND NOT REQUIRED.**
 *
 * `u` is what makes `.` one character rather than one UTF-16 unit, and half a
 * surrogate pair is half a four-byte sequence — exactly the mid-character
 * offset `semantic/8`'s header calls the silent defect. So it is asked for
 * first.
 *
 * It is not REQUIRED, because `u` also outlaws syntax a reader may reasonably
 * type: `\d` inside a class is fine but `[\w-]` unescaped, `\-`, `\p` without
 * a property and `{` on its own are all errors under `u` that a non-`u`
 * engine accepts. Refusing those patterns outright would be this screen
 * deciding that a reader's working expression is invalid because of a flag
 * they never asked for. So the pattern is compiled with `u`, and on failure
 * WITHOUT it — and `unicode` on the answer says which happened, so the panel
 * can tell a reader that this pattern is being read one UTF-16 unit at a time.
 */
function compileRegex(source, keepCase) {
  const base = keepCase ? 'g' : 'gi';
  try {
    return { re: new RegExp(source, `${base}u`), unicode: true, error: null };
  } catch {
    try {
      return { re: new RegExp(source, base), unicode: false, error: null };
    } catch (err) {
      return { re: null, unicode: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/**
 * **A QUANTIFIED GROUP THAT CONTAINS AN UNBOUNDED QUANTIFIER — `(X+)+` — AND
 * WHY THAT SHAPE IS REFUSED RATHER THAN RUN.**
 *
 * This exists because a measurement found the defect, not because somebody
 * worried about one. Typed into the panel against this repository's own
 * 139 MB session on 2026-09-16, with the between-span clock already in place:
 *
 *     ^(\w+\s?)+$        108,785 ms        timedOut: true
 *
 * **The time budget did not save it and CANNOT.** `FIND_REGEX_BUDGET_MS` is
 * checked BETWEEN spans; that was one span, inside V8's regular expression
 * engine, which has no backtrack limit and cannot be interrupted from
 * JavaScript. A hundred and nine seconds is not "slow" — it is the owner's
 * server not answering, and the browser half would freeze his tab the same
 * way.
 *
 * ── AND A RUNTIME CANARY WAS TRIED FIRST AND MEASURED TO BE UNSOUND ───────
 *
 * The obvious defence is to run the pattern on a short string and time it.
 * It was written, and then it was measured, and it does not work: the input
 * at which these patterns explode is far shorter than any string a canary
 * could learn anything from. `'word '` repeated, `^(\w+\s?)+$`:
 *
 *     4 words,  21 chars           2 ms
 *     8 words,  41 chars       3,848 ms
 *    12 words,  61 chars    >  6,000 ms (killed)
 *
 * and `(a*)*b` over **twelve** characters did not return at all. A canary
 * long enough to separate a bad pattern from a good one is long enough to
 * hang on the bad one, which moves the freeze rather than removing it. That
 * attempt is recorded here rather than deleted, because the next person to
 * have the idea deserves the measurement.
 *
 * ── SO THE CHECK IS STATIC, AND IT IS EXACT ABOUT WHAT IT REFUSES ─────────
 *
 * A group that is itself repeated — `)` followed by `+`, `*` or `{n,}` — and
 * whose body contains an UNBOUNDED quantifier. That is the shape whose cost
 * is exponential in the input length, because the engine must try every way
 * of partitioning the same text between the inner repetition and the outer
 * one. Every pattern measured above is this shape: `(\w+\s?)+`, `(a+)+`,
 * `(a*)*`, `(x+x+)+`.
 *
 * **What it deliberately does NOT refuse**, so the refusal stays narrow:
 *
 *   — `[\w.-]+@[\w.-]+` — two repeats, neither inside the other.
 *   — `\bbyte\s+offset\b` — no quantified group at all.
 *   — `(\d{4})-(\d{2})-(\d{2})` — the groups are not repeated, and `{4}` is
 *     BOUNDED, which is the distinction `{2,}` fails and `{2,4}` passes.
 *   — `(foo|bar)+` — repeated, but its body holds no quantifier.
 *
 * **And what it can still miss, said out loud.** Ambiguous ALTERNATION inside
 * a repeat — the textbook `(a|a)+` — is exponential with no inner quantifier
 * at all, and deciding whether two branches overlap is not a thing a scanner
 * can do. Measured on the shapes above it is orders of magnitude tamer, and
 * the between-span budget still bounds the multiplication across 4,582 spans;
 * but it is a residue, it is on the report, and it is the owner's to rule on
 * against the real fix, which is a killable child process or an engine with a
 * linear-time guarantee.
 */
export function nestedQuantifier(source) {
  // Each open group pushes whether an unbounded quantifier has been seen at
  // its own depth. `inClass` because `[+*]` is two literal characters.
  const stack = [];
  let loose = false;
  let inClass = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') { i += 1; continue; }
    if (inClass) { if (ch === ']') inClass = false; continue; }
    if (ch === '[') { inClass = true; continue; }
    if (ch === '(') { stack.push(loose); loose = false; continue; }
    if (ch === ')') {
      const body = loose;
      loose = stack.pop() ?? false;
      const after = source[i + 1];
      if (after === '+' || after === '*') { if (body) return true; loose = true; i += 1; continue; }
      if (after === '{') {
        const close = source.indexOf('}', i + 1);
        const spec = close === -1 ? '' : source.slice(i + 2, close);
        // `{n,}` is unbounded; `{n}` and `{n,m}` are not, and a group repeated
        // a bounded number of times is a bounded amount of backtracking.
        const open = /^\d+,$/.test(spec);
        if (open) { if (body) return true; loose = true; }
        if (close !== -1) i = close;
        continue;
      }
      continue;
    }
    if (ch === '+' || ch === '*') { loose = true; continue; }
    if (ch === '{') {
      const close = source.indexOf('}', i + 1);
      const spec = close === -1 ? '' : source.slice(i + 1, close);
      if (/^\d+,$/.test(spec)) loose = true;
      if (close !== -1) i = close;
    }
  }
  return false;
}

/**
 * **COMPILE ONCE, SCAN MANY** — the entry point both runtimes call.
 *
 * `findInDocument` reads 4,580 prose spans of this repository's own session
 * and `paintFinds` reads every drawn row on every paint. A `new RegExp` per
 * span would be the dominant cost of the feature and a `try`/`catch` per span
 * would be a decision about an invalid pattern taken 4,580 times and reported
 * none. So the pattern is compiled ONCE, here, and what comes back is either
 * a matcher or the reason there is not one.
 *
 * `options` is `{ caseSensitive, wholeWord, regex }`, every field optional and
 * every missing field `false` — so `findQuery(q)` with no options is exactly
 * `foldedMatches(text, q, limit)` and the whole of `semantic/8` is unchanged
 * by this file gaining three flags.
 *
 * The answer:
 *
 *   `{ ok: true, regex, unicode, find(text, limit) }`
 *   `{ ok: false, error }`  — the engine's own message, drawn verbatim.
 *   `{ ok: false, slow: true }` — a LEGAL pattern this scan will not run,
 *     because `nestedQuantifier` says it is the shape that took 108,785 ms.
 *     Not an error and not an empty box: a third answer, on purpose —
 *     `nothing-to-do-and-could-not-look-are-different-answers`, one more
 *     time, with a third door.
 *
 * An EMPTY query is `ok: false` with `error: null` and `slow: false`: there is
 * nothing wrong and there is nothing to find, which is neither of the above.
 */
export function findQuery(query, options = {}) {
  const keepCase = options.caseSensitive === true;
  const whole = options.wholeWord === true;
  const accept = whole ? wholeWordAt : null;
  if (typeof query !== 'string' || query === '') {
    return {
      ok: false, error: null, slow: false,
      regex: options.regex === true, unicode: false,
    };
  }
  if (options.regex !== true) {
    return {
      ok: true,
      regex: false,
      unicode: false,
      error: null,
      slow: false,
      find: (text, limit = Number.POSITIVE_INFINITY) => foldedMatches(
        text, query, limit, keepCase, accept,
      ),
    };
  }
  // **CHECKED BEFORE IT IS COMPILED, LET ALONE RUN.** See `nestedQuantifier`:
  // the measured freeze was 108,785 ms and nothing at runtime can stop one.
  if (nestedQuantifier(query)) {
    return { ok: false, error: null, slow: true, regex: true, unicode: false };
  }
  const { re, unicode, error } = compileRegex(query, keepCase);
  if (re === null) {
    return { ok: false, error, slow: false, regex: true, unicode: false };
  }
  return {
    slow: false,
    ok: true,
    regex: true,
    unicode,
    error: null,
    find: (text, limit = Number.POSITIVE_INFINITY) => regexMatches(re, text, limit, accept),
  };
}
