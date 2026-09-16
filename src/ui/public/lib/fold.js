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
 *   — **No `test` callback.** Upstream uses it for whole-word search. This
 *     archive's index is FTS5 with the **trigram** tokenizer, which has no
 *     word boundaries at all, and half this corpus is Hebrew, where a glued
 *     front particle means the boundary a Latin reader imagines is not there
 *     (`reports/2026-09-16-the-search-grammar.md` §3 Finding 4). A word
 *     boundary here would be a rule nobody could state.
 *   — **No `nextOverlapping`.** A find bar paints non-overlapping hits;
 *     upstream's own `next()` drops overlaps for the same reason.
 *   — **No `RegExpCursor`.** It needs the rope (`lineAt`, `slice`,
 *     `charCodeAt`, `iter.lineBreak`), and §6 of the grammar report already
 *     refused regex on the stronger ground that it cannot use the index.
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
 */
function fold(text) {
  return text.normalize('NFKD').toLowerCase();
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
 */
export function foldedMatches(text, query, limit = Number.POSITIVE_INFINITY) {
  const out = [];
  const folded = fold(query);
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
        partials, folded, code >= 0x41 && code <= 0x5a ? code + 0x20 : code,
        pos, byte, true, end, endByte, true,
      );
      if (hit !== null) {
        out.push(hit);
        partials.length = 0;
        if (out.length >= limit) return out;
      }
      pos = end;
      byte = endByte;
      continue;
    }
    const raw = String.fromCodePoint(code);
    const norm = fold(raw);
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
      if (hit !== null) {
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
