Lane AJ, `semantic/8` — `TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you`,
2026-09-16. The owner ruled two things and emphasised the second: *"3 write 40 lines of code - just
verify it works the same as the original code intended and every found search result in my viewer
should be highlited"*.

Nothing measured by lane AI (`reports/2026-09-16-search-adopt-or-build.md`), lane AF
(`2026-09-16-the-search-shipped.md`) or lane AC (`2026-09-16-the-search-grammar.md`) was
re-derived. Every number below is either theirs, cited, or one this lane took and says so.

---

## THE ANSWER IN TWO PARAGRAPHS

**The folding is 102 lines of JavaScript and it agrees with `SearchCursor` on 1,775,487 hits.**
`src/ui/public/lib/fold.js` normalises with NFKD and carries the ORIGINAL offset alongside the
normalised one, which is what upstream does and is why neither of us has any mapping-back
arithmetic to get wrong. Taken by EXECUTION, not by reading: the real `SearchCursor` was extracted
from the published tarball, given the three-line duck-typed `text` lane AI identified, and run
beside this one — **24 of 24 synthetic cases and 11,364 real archive spans × 20 queries agree
exactly on `from`, `to` and `precise`, with 0 differences and 0 byte mismatches.** On this
repository's live index today, a reader typing `...` reaches **463 spans as a substring, 463
through FTS5, and 1,024 folded — 2.21x**.

**Every match is painted where the reader is looking, and the count is the server's.** The document
is not in the browser, so the count comes from a scan of every prose span of the transcript
(`findInDocument`) and the highlight comes from the CSS Custom Highlight API rebuilt on every
paint. Driven by hand in both languages against this repository's own 133 MB session: typing `...`
in English paints the `…` character — the reader typed three dots and the ellipsis is what lit up —
under a line reading *"450 turn(s) of words hold what you typed, 1406 time(s) — searched in the
4511 turns of words this transcript has, out of 53738 records"*; typing `שורה` in Hebrew paints the
bare word and the glued `השורה`, 17 times over 9 turns. A highlighted row was scrolled out of the
window and back and came back painted, with every range a live text node and none collapsed.

---

# 1. THE FOLDING ARITHMETIC, AND HOW IT WAS PROVED AGAINST `SearchCursor`'S INTENT

## 1.1 What `SearchCursor` actually does, read off its own source

`@codemirror/search@6.7.2` was downloaded from `registry.npmjs.org` into a scratch directory.
**The published tarball has no `src/`** — eight files, `dist/` only — so what was read is the
compiled `dist/index.js`, lines 5–134, which is the same algorithm with the types erased. Four
things matter and only the third is hard:

1. `basicNormalize = x => x.normalize("NFKD")`, applied to the query as a WHOLE STRING and to the
   text **one code point at a time**. A caller's `normalize` is composed OUTSIDE it —
   `x => normalize(basicNormalize(x))` — so case folding runs after NFKD, never before.
2. It walks the ORIGINAL text by code point and feeds each code point's normalised units, one unit
   at a time, into a machine holding every partial match in flight at once (`this.matches`).
3. **The offsets are never mapped back, because they are never mapped away.** A partial records the
   ORIGINAL offset it began at; a completed match ends at the original offset just past the code
   point whose expansion finished it. There is no second pass and therefore nothing to get wrong.
4. `precise` is `false` when the match begins or ends INSIDE a code point that expanded. Typing
   `..` finds `…` and the range covers the whole ellipsis, which is a superset of what matched.

Point 3 is the whole design and it is why 40 lines is a fair estimate. **The implementation a hand
would reach for first — normalise the string, `indexOf`, walk back — is wrong for every offset
after the first folded character, and wrong silently**, because a wrong byte offset in this product
lands mid-record and reports `unreadable` rather than throwing.

## 1.2 What this lane wrote, and what it deliberately does less of

`src/ui/public/lib/fold.js`, **102 lines of code** in a 305-line file — the rest is a header that
argues for itself. `foldedMatches(text, query, limit)` answers
`{ from, to, byteFrom, byteTo, precise }` per hit.

**The owner sized this at about forty lines and it came out at 102, so here is where they went.**
83 of them are the folding and the offset machine — which is the ~40 of `.normalize('NFKD')` plus
the ~40 of carrying the original offset that the item itself predicts, and the byte currency
threads through both. **16 are the ASCII fast path**, which is not part of the idea at all: it is a
measured optimisation that took a whole-session scan from 717 ms to 116 ms (§1.6) and it was not
foreseeable before the scan was run. 3 are `foldedHolds`. Against lane AI's ~148 for
`SearchCursor` plus its five helpers, the hand-written version is smaller because everything in the
table below was left out.

Dropped on purpose, each with the case it cannot meet here:

| dropped | why it cannot arise |
|---|---|
| the `Text` rope and `iterRange` | a span IS a JavaScript string here — `conversation_prose.text` on the server, a text node's `data` in the browser. Upstream needs the iterator because CodeMirror's document is a 583-line rope. |
| the `test` callback (whole-word search) | this index is FTS5 under the **trigram** tokenizer, which has no word boundaries at all, and half this corpus is Hebrew, where a glued front particle means the boundary a Latin reader imagines is not there (AC §3 Finding 4). |
| `nextOverlapping` | a find bar paints non-overlapping hits. Upstream's own `next()` drops overlaps for the same reason, and that behaviour IS kept. |
| `RegExpCursor` | needs `lineAt`, `slice`, `charCodeAt` and `iter.lineBreak` — the real rope — and AC §6 already refused regex on the stronger ground that it cannot use the index. |

**And one case is handled DIFFERENTLY rather than dropped.** Upstream's `pos++` walks the original
offset forward inside one character's expansion while the expansion is still prefix-identical to
the original — reachable only for an astral character whose NFKD is itself, where the two UTF-16
units are its own surrogate pair. `at` follows it, because `from` is a code-unit offset and that is
upstream's answer. **`atByte` does not**: half a surrogate pair is half a four-byte UTF-8 sequence
and there is no byte offset at that position to report. The byte offset stays on the character's
own boundary and the match is marked imprecise. It is reachable only by a query whose FIRST unit is
a lone low surrogate — half a character, which no text input can produce — and it is written out
rather than dropped so the two implementations agree on inputs a fixture can construct.

## 1.3 The part upstream does not answer at all: BYTES

`SearchCursor` answers in **UTF-16 code units**; this project's currency is **UTF-8 bytes** — every
anchor, every seek, every `byteOffset`. Lane AI measured the divergence at 53,268 bytes over one
session's 4,394 spans, one span diverging by 943.

So the byte offset is **accumulated on the same walk** rather than converted afterwards by a second
pass that could disagree with the first: `byte += utf8Len(code)` per code point, and a partial
carries `byteFrom` beside `from`. The invariant — `byteFrom === the UTF-8 length of the text before
the match` — is checked against `TextEncoder` on every hit found, both in the test and across the
whole archive (§1.4).

## 1.4 The equivalence, taken by EXECUTION

`SearchCursor` and the three `@codemirror/state` char helpers it needs (`codePointAt`,
`fromCodePoint`, `codePointSize` — 25 of that file's 37 lines, as lane AI said) were lifted
verbatim into a scratch file with the `import` lines removed, and given a **three-line duck-typed
`text`** satisfying exactly the five members lane AI identified (`length`, `iterRange`,
`iter.next`, `iter.value`, `iter.done`). **That claim of AI's — that no rope is needed — is now
confirmed by running it rather than by reading it.**

```
  synthetic cases                          24 of 24 agree on [from, to, precise]
  the live archive, 11,364 prose spans     20 queries · 1,775,487 hits
                                           DIFFERENCES        0
                                           BYTE MISMATCHES    0
```

The 20 queries were `... .. .... "byte offset" trigram the - " o ui שלום לום רשות search NFKD … i =
| micro` — deliberately including the pathological ones (`o` alone is 671,841 hits over 11,167
spans) so the agreement is not an agreement about rare paths.

**The golden table in `test/ui/fold.test.ts` is that run's output**, generated mechanically and
pasted, not hand-written — the first hand-written draft had two rows wrong and reddened, which is
how this is known. Upstream's source is NOT in the repository: embedding it to compare against
would mean vendoring it — a `LICENSE-codemirror.txt`, a `VENDOR.md` section and a SHA-256 pin — for
a library the owner ruled out.

## 1.5 What the folding buys, re-measured on the live index today

Lane AI measured 456 → 1,012 spans on `...`. The corpus has grown; the mechanism has not changed:

```
  archive prose spans                                        11,364
  spans that change under NFKD                                  817
  ...of which change LENGTH                                     791

  query      plain indexOf     FTS5 trigram      folded
  "..."          463               463            1,024     <- 2.21x
  ".."           508                 0            1,041     <- FTS5 cannot see it at all
  "-"          5,110                 0            5,110
  "\""         2,710                 0            2,710
  "micro"         20                20               20     <- no folding to do, and it agrees
  "byte offset"  106               106              106
```

Read the `..` and `-` rows: **a two-character query is a silent zero on the trigram index**, and
the find bar has no such floor because no index is involved in it.

## 1.6 The cost, and the one optimisation that was needed

Measured on the largest transcript in this archive — 11,336 prose spans, 13,206,532 characters,
median of 9:

```
  proseSpans read for that session                   159.3 ms
  scan for "..."            717.2 ms  ->  116.5 ms
  scan for "byte offset"    704.8 ms  ->  111.5 ms
  scan for "the"            758.0 ms  ->  159.9 ms
```

The left column is the general path, which allocates two strings per character. The right column is
with an **ASCII fast path**, and it is exhaustive rather than typical: every code point below
U+0080 is NFKD-stable and `toLowerCase` over that range is `A`–`Z` plus 32. `test/ui/fold.test.ts`
asserts that for all 128 of them against `fold` itself, and **the whole 1,775,487-hit comparison
against `SearchCursor` was re-run with the fast path in place and still reported 0 differences.**

Behind the find box's existing 250 ms settle, one whole-session scan per query. The owner's real
session answers in about 300 ms end to end.

---

# 2. WHY IT DOES NOT ASK FTS5, WHICH IS NOT THE OBVIOUS SHAPE

Lane AI sketched two stages: FTS5 narrows to candidate spans, the cursor finds offsets inside them.
**That shape cannot be used here and the reason is in the table above.** FTS5 finds 463 of the
1,024 spans holding `...` and would hand the second stage 463 — losing 561 SILENTLY, which is
precisely `INV-nothing-is-dropped-silently`. The index holds the text unfolded; a folded question
cannot be asked of it.

So `findInDocument` scans every prose span of the transcript. That is affordable (§1.6) and it is
the only shape that answers the question being asked. Both halves of the reasoning are in the
function's header so the next reader does not re-derive the two-stage idea and find out the
expensive way.

The second FTS5 bound stands independently and is lane AI's, verified against this live index:
**`offsets(conversation_prose)` fails with "unable to use function offsets in the requested
context"** — it is an FTS3/4 function. `highlight()` and `snippet()` return marked-up TEXT, not
positions. A highlight needs positions.

**And `searchArchiveTiered` was not touched.** Lane AF flagged the collision for this lane — its
tiers de-duplicate across readings, so its order is a RANKING, and a find bar needs document order.
This surface does not consult the tier at all; the archive answer is unchanged and unchallenged.

---

# 3. WHAT THE HIGHLIGHT COUNT COUNTS

**It counts TURNS OF WORDS in this one transcript that hold the query, computed on the server by
scanning every prose span of it.** The line on the screen says so in as many words, in both
languages:

> 456 of 15760 sections are shown. 449 turn(s) of words hold what you typed, 1403 time(s) —
> searched in the 4495 turns of words this transcript has, out of 53561 records. Tool output and
> machinery are not indexed and can only be found here by the tools they ran.

Four decisions are in that sentence and each was forced:

**(a) It is not a count of drawn rows.** The session is 133 MB over ~53,500 records and the page
holds an outline plus a windowed `bodies` cache. A DOM walker would have answered *"in the rows I
have"* and said nothing about it. In the e2e fixture the count is 12 while fewer than 12 rows are
drawn, and the test asserts both — so a DOM-walking implementation reddens.

**(b) It is TURNS, not occurrences — and that is not timidity.** The server matches the RECORD's
text; the browser paints the RENDERED text; **those are different strings and neither is wrong.**
Markdown syntax is in one and not the other, so `the **byte** offset` holds `byte offset` after
rendering and not before, and `**byte` holds it before and not after. A headline count of
occurrences would be a promise about painted ranges that the renderer is free to break. A count of
turns is true on both sides. The per-turn occurrence figure is served and drawn beside it as what
it is — *"1403 time(s)"*, the record's own text — and never as a count of highlights.

**(c) The scope is on the line.** `scanned` against `records` is the 1.08% gap lane AI's report
closes on: **47,910 of one session's 52,292 records are machinery**, in no index, findable on this
surface only by the tools they ran. Nothing on any surface said so before this line.

**(d) Turns the page cannot reach are counted separately and named.** A document whose walk stopped
at `DOCUMENT_WALK_CAP` runs on past its last drawn node; the index has those turns and the outline
does not. They are not stops, they are not nothing, and `conv.doc.findUnreached` /
`conv.nav.foundsUnreached` say how many — beside `conv.doc.truncated`, which is already on the page
for the same reason.

**The bounds are disclosed rather than silent.** `FIND_SCAN_CAP` (40,000 prose spans — three and a
half times the largest transcript here) sets `capped`, which draws a sentence.
`FIND_HITS_PER_TURN` (500) bounds the per-turn figure. `FIND_PAINT_PER_ROW` (300) bounds the
DRAWING only and is deliberately silent, because the count beside the box does not come from it.

---

# 4. THE HIGHLIGHT, AND THE CLAIM THAT WAS VERIFIED BEFORE ANYTHING RESTED ON IT

The brief said to verify the CSS Custom Highlight API myself, including what happens when a
highlighted row is evicted and redrawn. Driven in Chromium:

```
  CSS.highlights + Highlight present                          true
  registering a Range changes the row's innerHTML             NO
  registering a Range changes the row's box                   NO      (top and height identical)
```

**And the eviction result is not the one the design was expecting, which is why it was worth
taking.** A `Range` into a row that is removed from the DOM does NOT go inert:

```
  before eviction   startContainer #text   offsets 6..10   text "beta"
  after  eviction   startContainer DIV     offsets 0..0    text ""     COLLAPSED, still connected
```

The DOM collapses a live range to its former parent. So a highlight registry kept across a paint
would hold a set of **collapsed ranges anchored at the container, painting nothing, while
`CSS.highlights.has(…)` still answers `true`** — a silent failure of exactly the kind this project
refuses. `paintFinds` therefore rebuilds the whole registry from `live` on every paint, which costs
one walk of about twenty rows and cannot go stale. `e2e/conversations-find.spec.ts` asserts, after
a scroll out and back, that every registered range is a live text node and that none is collapsed.

**What is painted is the RENDERED text of each drawn row, joined.** `markdownNodes` splits *"the
**byte** offset"* into three text nodes and a matcher run per node would find neither phrase a
reader can plainly see, so the row's text nodes are concatenated and a match is mapped back to
`(node, offset)` by binary search. A separator is inserted wherever the nearest block-level
ancestor changes (`FIND_BLOCKS`), so a match cannot run from the end of one paragraph into the
start of the next — a fixture with `…ends with zebra` / `quagga begins it…` in two paragraphs pins
it, and searching `zebraquagga` finds nothing.

---

# 5. THE PLAYWRIGHT EVIDENCE, IN BOTH LANGUAGES

## 5.1 Driven by hand, against THIS repository's live 133 MB archive

Own throwaway server on **port 58917**, `--no-open`, restarted after every change outside
`src/ui/public/`, and killed at the end. **Port 58888 was never touched.** The shared MCP browser
turned out to be held by the `anchors/15` lane — two of this lane's `evaluate` calls landed on that
lane's page before it was noticed — so everything below was driven from this lane's **own**
headless Chromium, one page at a time, and the MCP browser was left with only the other lane's tab.

**English, `...` typed one character at a time:**

```
  count line   458 of 15811 sections are shown. 450 turn(s) of words hold what you typed,
               1406 time(s) — searched in the 4511 turns of words this transcript has, out of
               53738 records. Tool output and machinery are not indexed and can only be found
               here by the tools they ran.
  stepper      450 turn(s) here hold what you typed.
  painted      13 ranges over 8 drawn rows, every one of them the character "…"
  Next         "Match 1 of 450."   then "Match 2 of 450."
```

The reader typed three dots and **the ellipsis character is what lit up**. That one line is the
whole of part ONE, visible.

**Hebrew, interface in Hebrew (`dir=rtl`), `שורה` typed:**

```
  count line   9 מתוך 15815 קטעים מוצגים. 9 תורות של מילים מכילים את מה שהקלדתם, 17 פעמים —
               חיפשנו ב־4512 תורות המילים שיש בתמליל הזה, מתוך 53756 רשומות…
  stepper      9 תורות כאן מכילים את מה שהקלדתם.
  painted      16 ranges over 8 drawn rows, every one of them "שורה"
  Next         "התאמה 1 מתוך 9."   then "התאמה 2 מתוך 9."
```

9 turns and 17 occurrences is the bare word **and** the glued `השורה` — the substring reading
working in Hebrew, which is the reason the index under all of this is `trigram`.

**Seen, not only counted.** A screenshot of the Hebrew well shows `שורה` painted gold-on-dark
inside the inline code span `'הפרש ברמת השורה'`, mid-sentence, RTL. The English screenshot shows
`byte offset` painted inside the word `offsets` in *"The open page holds byte offsets into the
transcript file"*.

**A highlighted row scrolled out and back**, English:

```
  before   44 ranges over 14 drawn rows, texts ["…","…","…"]
  away     88 ranges over 15 drawn rows, at scrollTop 31436
  back     44 ranges over 14 drawn rows, texts ["…","…","…"]
           every range is a live text node: true   |   collapsed ranges: 0
```

and in Hebrew, the same walk:

```
  before   16 ranges over 8 drawn rows, texts ["שורה","שורה","שורה"]
  away     15 ranges over 7 drawn rows, at scrollTop 4677
  back     16 ranges over 8 drawn rows, texts ["שורה","שורה","שורה"]
           every range is a live text node: true   |   collapsed ranges: 0
```

## 5.2 Driven by the suite

`e2e/conversations-find.spec.ts` — 7 tests × 2 languages, **14 passed**. Its fixture is 60 long
turns (long enough that the scroll really virtualises), one Hebrew turn carrying `שורה` and
`השורה`, one two-paragraph turn, and **the ellipsis character with no literal `...` anywhere** —
which is the folding's removal proof carried by the fixture itself, re-asserted in the browser
before each run.

---

# 6. EVERY REMOVAL PROOF, AND WHAT REDDENED

Each mutation was applied alone, the suite run, the mutation reverted. Baseline: 0 failures.

## 6.1 The matcher and the scan — `test/ui/fold.test.ts`, `test/core/conversation-search.test.ts`

| # | what was removed | reddened |
|---|---|---|
| M1 | `fold()` stops normalising — NFKD gone | **17** — the whole golden table's folded rows and *reaches an ellipsis a reader typed as three dots* |
| M2 | `fold()` stops folding case | **3** — `ＡＢＣ/abc`, `x𝐀y/a`, *folds case, because the index it stands beside folds case* |
| M3 | the byte walk becomes a character walk (`utf8Len` always 1) | **2** — *answers in UTF-8 bytes…*, *keeps the byte offset true across a character that CHANGES LENGTH* |
| M4 | a hit no longer clears the partials, so hits may overlap | **1** — `…………/...` |
| M5 | every hit claims to be `precise` | **1** — `a … b / ..` |
| M6 | the caller's bound is ignored | **1** — *bounds its answer when asked* |
| M7 | an empty query is no longer refused | **0** — see below |
| M8 | the ASCII fast path stops folding case | **1** — *folds case…* |
| M9 | the answer is no longer put back into document order | **1** — *a find answers in DOCUMENT order* |
| M10 | the scope stops naming the transcript, so lanes join the answer | **1** — *a find over a session does not answer with its lanes' turns* |
| M11 | `scanned` reports the turns FOUND rather than the turns READ | **1** — *a find says how much it read* |
| M12 | `firstByte` answers in characters, the way `SearchCursor` would | **1** — *a hit says where in the turn it is, in BYTES* |

## 6.2 THREE PROOFS REDDENED NOTHING ON THE FIRST RUN, AND THAT IS THE PART WORTH READING

The brief warned about a fixture that fails to carry a red, citing lane AF hitting exactly that
yesterday. Three of these did.

**M9 — the document-order fixture was built backwards.** It gave record 1 the LATER timestamp,
which is the order `ORDER BY at DESC` answers in anyway — so deleting the sort under test changed
nothing and the proof was empty, while the test sat green and looked responsible. The stamps now
run the other way: the source hands back `[2, 1]` and only the sort makes it `[1, 2]`. The
crossover is recorded in the fixture's own comment rather than quietly repaired.

**M6 — the bound was only ever exercised on one of two paths.** Every character in
`foldedMatches('aaaaaaaa', 'a', 3)` is ASCII, so the assertion never reached the general branch and
deleting the bound there reddened nothing. A folded fixture (`……………`, six ellipses) was added beside
it. **This is the ASCII fast path's own cost, found by trying to remove something.**

**M7 — the guard is not load-bearing, and it is now labelled as not load-bearing.** Deleting
`folded === ''` reddens nothing and never could: an empty query gives `charCodeAt(0) === NaN`,
which no unit equals, so the machine already answers `[]`. The line saves a walk of the whole text
and nothing else. It is kept, with a comment saying exactly that, rather than dressed up as a
covered assertion — the BEHAVIOUR is pinned, and pinned to the machine rather than to that line.

## 6.3 The browser half — `e2e/conversations-find.spec.ts`

Same method, in both languages, so every row below is two failures per test named.

| # | what was removed | fails | reddened |
|---|---|---|---|
| E1 | nothing is painted at all | 10 | *three dots*, *scrolled out and back*, *a Hebrew word*, *one paragraph into the next*, *clearing the box* |
| E2 | `paint()` stops calling the painter | 10 | the same five |
| E3 | **the registry is kept across a paint instead of rebuilt** | 6 | *three dots*, ***scrolled out and back***, *one paragraph into the next* |
| E4 | the view stops taking the server's answer | 14 | all seven |
| E5 | an emptied box leaves the registry standing | 2 | *clearing the box* |
| E6 | the first step goes past the match the reader is standing on | 3 | *the stepper walks the matches*, *the count says what it counts* |
| E7 | a match may run across a paragraph boundary | 2 | *a match cannot run from one paragraph into the next* |
| E8 | the count line stops naming its scope | 2 | *the count says what it counts* |

**E3 is the one worth reading**, because it is the mutation that makes the design's own claim
falsifiable: caching the highlight registry instead of rebuilding it from `live` leaves the page
holding ranges into rows the virtualiser threw away, and the *scrolled out and back* test is what
catches it. Without that test the failure is invisible — the registry still reports itself as
present.

## 6.4 AND TWO ASSERTIONS THIS LANE WROTE WRONG AND CORRECTED

**`toContain('12')` on a line that also says `121`.** The count assertion could not fail: the
substring `12` is inside `121`, so the count could have been anything at all. Every number on the
line is now pulled out and compared as a NUMBER. The same defect was in the stepper's
`toContainText('1')`, beside a `12`.

**The e2e suite passed 12 of 12 on its first run**, which is why both of those were looked for.

---

# 7. THREE DEFECTS FOUND AFTER IT WORKED, AND FIXED

**A step landed on the TURN and not on the MATCH.** `landOn` writes `scroller.top(row)`, which is
the top of the turn; turns here run to tens of thousands of characters, so stepping to a match put
the reader at the head of a wall of text with the highlight several screens below the fold —
highlighted, and not where he is looking, which is exactly what the item says a hit that cannot be
seen is worth. `showMatch` now measures the first match's own `Range` box, after the paint, and
nudges the scroll only when it is outside the visible area. **And the visible area is the
INTERSECTION of the well and the viewport, not the well**: measured on a 1280×800 window,
`.tvscroll`'s own box runs past the bottom of the screen, so a test against the well alone called a
match at y=795 "visible" on 800 pixels of screen that did not contain it.

**A failed scan went on describing the previous query.** `askFind` returned quietly when the
endpoint refused, which leaves `findBody` and `foundAt` holding the answer to a query the reader
has since replaced — so the count line would go on describing the OLD words under the NEW ones,
with nothing on the screen saying so. Found by reading the handler back rather than by a test, and
it is now cleared: the line falls back to the outline reading, which is the answer that is still
honestly available.

**The first Next skipped match 1.** A query settles with the reader at `scrollTop = 0`, which IS the
first match, and the mark walk's rule — *the next stop after the one under the viewport* — made the
first press announce "Match 2 of 12" and left match 1 reachable only by pressing Previous. Correct
for a mark, which the reader placed and can see; wrong for a match they have only just asked for.
`findFresh` lets the FIRST step after a query land on the match at the viewport, exactly once, and
`endWalk` — which `wheel`, `keydown` and `pointerdown` already call — spends it. A reader who has
scrolled is back under the rule that does not stall.

---

# 8. WHAT IS THE OWNER'S TO DECIDE

1. **The stepper bar is now three lines of groups instead of two.** Measured at 1280×1000: idle
   60.8 px, with a query typed **162.8 px** in English and 95.2 px in Hebrew (the Hebrew sentences
   are shorter). The grouping rule the bar already had is intact — each pair and its count wrap as
   one unit, so a count can never be orphaned onto the wrong pair — but it is taller, and the
   comment above `markGroup` records a measurement of two lines that is no longer true of a
   document with a query in the box. Worth his eye.

2. **The count is turns, not occurrences.** §3(b) argues it. If he wants a number of HIGHLIGHTS
   instead, that is a different number, it can only mean *"in the rows drawn"*, and this lane would
   refuse to draw it without a sentence saying so.

3. **Machinery is still unsearchable on this surface**, and now it says so on every count line.
   That is a disclosure, not a fix. Lane AI's finding 1 is the fix, it is a different build, and it
   is not scheduled.

---

# 9. FOUND AND DELIBERATELY NOT CHANGED

1. **`conv.doc.matched` was REWRITTEN, not left beside a changed feature.** It said *"The search
   reads the first {peek} characters of each turn and the tools each run used, not every word of
   the file"*, which stopped being true the moment the full-text answer joined the filter. It now
   describes the state it is actually drawn in — the outline reading, before the scan has answered
   — and `conv.doc.matchedFull` is the sentence for after. A stale sentence beside a changed
   feature is the defect this project measures; lane AF rewrote `conv.arch.idle` yesterday for the
   same reason.

2. **`foundStops().hidden` is always zero today and is returned anyway.** `reView` puts every found
   node into the view by construction, so a found turn the filter is hiding cannot exist. It is
   returned so that a later edit which narrowed the view has a counter already able to say so; the
   comment says which of the two it is.

3. **The server can find a turn the browser cannot paint.** If a match spans Markdown syntax the
   renderer removes, the record holds it and the rendered text does not. The turn is still in the
   view and still the right turn, and `showMatch` returns silently rather than inventing a
   position. It is the inverse of §3(b) and it is the honest bound of matching what a reader sees.

4. **`precise` is computed on every hit and read by nothing today**, and that is said rather than
   left for the next reader to notice. It is what makes a wide range honest — typing `..` matches
   inside `…` and the range covers the whole character — and the wide range is the CORRECT drawing,
   so there is nothing for a caller to do differently with the flag yet. It is kept because it is
   half of what "the same answers as `SearchCursor`" means and because the golden table asserts it
   on every row; dropping it would make the equivalence claim smaller without making anything
   simpler. **This project has shipped a field nobody read before, so: this one is not a mistake,
   it is a pinned invariant with no consumer.**

5. **`src/ui/read-model-conversation-document.ts` is NOT in `semantic/8`'s declared scope.** The
   feature cannot reach a screen without an endpoint, and it is named here so the omission is
   visible — the same shape lane AF recorded for `read-model-conversations.ts` yesterday.

6. **One repair outside the brief, requested mid-lane by the dispatcher:**
   `src/core/conversation-search.ts:248` cited `STD-nothing-to-do-and-could-not-look-are-different-answers`,
   which resolves to no corpus item. It is a RULE STORE entry and the established form is the bare
   entry id — line 937 of the same file already used it. The `STD-` prefix was dropped and nothing
   else in the sentence changed. No other occurrence exists in `src/`, `test/`, `e2e/` or
   `scripts/`. Reports that mention the phantom id as the SUBJECT of a finding were not touched.

---

# 10. FILES TOUCHED BY THIS LANE

**New:**

  — `src/ui/public/lib/fold.js` — the matcher. Plain JavaScript, no DOM, no strings, no import, so
    the browser imports it and `core/conversation-search.ts` loads it with a top-level
    `await import()` (the precedent is `ui/execute-catalogue.ts` loading `palette-defs.js`, and the
    reason is the same: the function stays synchronous). **One spelling, two runtimes** — a count
    computed on the server and a highlight painted in the browser by two different matchers would
    disagree about what a hit is.
  — `test/ui/fold.test.ts` — 36 tests, 25 of them the golden table.
  — `e2e/conversations-find.spec.ts` — 7 tests × 2 languages, and its own fixture.

**Changed, with the hunks named so the commit can be split** (another lane, `anchors/15`, holds
work in two of these files):

  — `src/core/conversation-search.ts` — **this lane holds this file.** One appended section at the
    end: `FIND_SCAN_CAP`, `FIND_HITS_PER_TURN`, the `await import` of `fold.js`, `FoundTurn`,
    `DocumentFind`, `findInDocument`. Plus **one word at line 248** — the `STD-` prefix dropped
    from a citation (§9.6). Nothing else in the file was read for edit.
  — `src/ui/read-model-conversation-document.ts` — one import, `DocFindBody` +
    `apiConversationFind` immediately before `registerConversationDocumentRoutes`, and one
    `registerRoute` for `/api/conversations/:id/find` placed **before** `/nodes`. Not in scope
    (§9.5).
  — `src/ui/public/screens/conversations.js` — **`anchors/15` is in this file too, so the split is
    given by NAME rather than by hunk count.** Everything this lane wrote is one of these, and
    nothing else in the file was read for edit:
      1. one `import` line beside `transcript-scroll.js`, for `foldedMatches`;
      2. module constants immediately above `const OVERSCAN = 6` — `CAN_HIGHLIGHT`,
         `FIND_HIGHLIGHT`, `FIND_PAINT_PER_ROW`, `MATCH_MARGIN_PX`, `FIND_BLOCKS`;
      3. five state declarations after `const inflight = new Set()` inside `mountDocument` —
         `foundAt`, `findBody`, `findUnreached`, `findGen`, `findFresh`;
      4. in `reView`: the `|| foundAt.has(i)` on the view predicate, and the `conv.doc.matchedFull`
         branch of the count line;
      5. `rowText` and `paintFinds`, immediately above `paint`, plus the single `paintFinds();` at
         the foot of `paint`;
      6. `askFind`, and the `settler` callback that replaced the one-line `typing` wiring;
      7. the stepper — `foundStops`, `showMatch`, `foundPrev` / `foundNext` / `foundCount` /
         `foundGroup`, `cursor.found`, four `step` branches, two `addEventListener`s, and the
         `founds` block at the foot of `navRefresh`.

    **The other lane's markers in the same file, untouched by this one:** `sayTakenBack`,
    `convtakenkind`, `tvanchorone`. They are still present after this lane's work.
  — `src/ui/public/strings/en.js`, `src/ui/public/strings/he.js` — **fourteen new keys** (ten
    `conv.nav.found*`, four `conv.doc.find*`/`matchedFull`) and **one rewritten**
    (`conv.doc.matched`, §9.1). **The other lane's `conv.nav.marksDoubled` is in the same diff and
    is not this lane's** — it is the only other added key in either table.
  — `src/ui/public/styles.css` — **one rule**, `::highlight(mycontextfind)`, appended directly
    after `.tvnavat`. Nothing else. (The other lane's `.tvanchorone`, `.convtakenkind` and the
    `kindsettled`/`kindowed`/`kindfound` selector list are elsewhere in the same file and were not
    touched.)
  — `docs/cli-ui-coverage.md` — **generated, never edited**; see §11. Not in scope.
  — `test/core/conversation-search.test.ts` — `@basis` extended with this task, one import line,
    seven appended tests. It reuses the file's own `fixture`, `indexed`, `say`,
    `machineryWithText` and `toolResult` helpers and adds none.
  — `test/ui/server-e2e.test.ts` — **one probe** in `READ_ROUTES`. §11(b).
  — `test/ui/no-writes.test.ts` — **one entry** in `DYNAMIC_EDGES`. §11(c).

**No file outside this list was written by this lane.** `package.json` was not touched and no
dependency was added. Nothing was vendored.

**Corpus:** `TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you`, edited through
`mycontext edit --yes`, never by hand.

---

# 11. GATES

```
npm run typecheck        0
npm run check:text-files 0   1428 files, none contains a NUL byte
npm run check:basis      0
npm run check:board      0
npm test                 8784 tests, 8777 pass, 4 fail — ALL FOUR PRE-EXISTING, see below
npx playwright test e2e/conversations-find.spec.ts   14 passed
```

## THE FOUR `npm test` FAILURES ARE ON `HEAD` AND NONE IS THIS LANE'S

They come from **two committed files this lane never opened**, and each was checked against the
committed tree with read-only `git show HEAD:` rather than asserted. They are three findings, in
four tests:

  1. **`test/core/turn-refresh-soon.test.ts` removes trees with a bare `rmSync`** — four lines of
     it, and `git show HEAD:` counts the same four. `test/no-bare-rmsync.test.ts` wants
     `removeTree` from `test/helpers/tmp.ts` instead, for the Windows retry budget. *(1 test:
     "no test file removes a tree with a bare rmSync".)*
  2. **`test/ui/lane-ctx.test.ts` carries TWO `@basis` lines in one header**, which the gate calls
     MALFORMED — *"write ONE declaration listing every id it rests on, or the two readings of this
     file disagree"*. `git show HEAD:` has both lines. It is the anchors lane's file and names
     `TASK-every-anchor-write-inside-a-lane-document-is-refused-because`, whose item is still
     UNTRACKED in this tree. The repair is joining two lines into one. *(2 tests.)*
  3. **`e2e/runs.spec.ts` declares a basis and is still listed at line 80 of
     `scripts/basis-undeclared.txt`**, so one exemption is spent — which is exactly the 683-vs-684
     count at `basis-gate.test.ts:136`. Both halves are on `HEAD`, and the gate states its own
     repair: *"deleting them is the whole repair."* *(1 test.)*

**None was touched here.** The brief is explicit about not writing in a file another lane is
holding, and a lane that quietly repairs somebody else's gate failure makes the count harder to
verify — which is the reasoning lane AF gave yesterday for the phantom id it left alone.
`npm run check:basis` exits **0** on all of them; only the stricter test reddens.

**This lane's own new and changed test files are green**: `test/ui/fold.test.ts` 36/36,
`test/core/conversation-search.test.ts` 28/28, `test/ui/no-writes.test.ts` 21/21,
`test/ui/server-e2e.test.ts` 22/22, `e2e/conversations-find.spec.ts` 14/14.

---

## THREE GATES THIS WORK TRIPPED, AND WHAT EACH ONE WANTED

**None of them is optional and none of them was foreseen; all three were found by running the
suite, which is the point of them.**

**(a) `docs/cli-ui-coverage.md` is generated from the live route table.**
`test/docs/doc-system.test.ts` re-renders it and fails on any difference, so a new route makes it
stale by construction. `node scripts/gen-cli-ui-coverage.ts` was run and its whole diff is **two
lines**: `66` → `67 registered UI read routes`, and `GET /api/conversations/:id/find` joining the
`mycontext conversation` row. Nothing of the other lane's uncommitted work was swept into it.

**(b) `test/ui/server-e2e.test.ts` refuses a registered route with no concrete probe** — *"these
routes are registered and never exercised by the no-write sweep, so nothing proves they do not
write"*. A probe was added to `READ_ROUTES` beside the `/outline` and `/nodes` ones, on the same
session id no index can hold. It is worth having for a reason of its own: **this is the one route
in the product that reads EVERY prose span of a transcript**, so if the read-only index door were
ever opened for writing, it is the route that would touch it hardest.

**(c) `test/ui/no-writes.test.ts` refuses a dynamic `import()` in the reachable graph** — *"an edge
with no statement to read, so the module it loads is outside every assertion in this file"*.
`src/core/conversation-search.ts` → `src/ui/public/lib/fold.js` is now the FOURTH entry in
`DYNAMIC_EDGES`, named with the reason and with `test/ui/fold.test.ts` as the test that holds the
target. The three before it are `session-summary` → `conversation-index`, `execute-catalogue` →
`palette-defs.js`, and `retrieval/subjects` → the vendored tokeniser, and this one is the same
shape as the last two: a typed module reaching a browser asset through a URL, because `allowJs` is
off. `fold.js` is a pure function over two strings — no import, no DOM, no `node:` anything — so
there is no write API down the edge and none it could acquire unseen.

---

# 12. WHAT WOULD MAKE THESE NUMBERS WRONG

  — **The equivalence is against `SearchCursor` 6.7.2 with `normalize: x => x.toLowerCase()`.** A
    caller passing a different `normalize` composes differently and the agreement is not claimed
    for that.
  — **The corpus grows under the measurement.** This session is itself being indexed: the archive
    was 11,364 prose spans when §1.5 was taken and the session's own record count moved during the
    lane (4,467 → 4,511 prose turns between runs hours apart). Every figure is right for the
    run printed beside it.
  — **The NFKD win is measured as spans REACHED, not as spans a reader wanted.** 463 → 1,024 is
    recall; nothing here says the extra 561 are relevant. Lane AI's own caveat, and it still holds.
  — **Hebrew in this archive is thin.** `שלום` returns 0 spans and `רשות` returns 3 over the whole
    archive; the Hebrew driven above used `שורה`, which this session genuinely holds 17 times. AC's
    §3 is the evidence about the MECHANISM and this is that mechanism confirmed on real traffic,
    not a replacement for it.
  — **The cost figures are Node's, on this machine, with the index warm.** The 159.3 ms
    `proseSpans` read is the dominant term and it is I/O.
  — **`FIND_PAINT_PER_ROW` has no test.** It bounds the drawing only, the count does not come from
    it, and a fixture that reached 300 matches in one visible row would be a fixture about nothing
    else.
