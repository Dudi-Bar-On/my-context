Lane AR, `semantic/11` — `TASK-the-find-panel-offers-regular-expressions-and-no-help-and`,
2026-09-16. The owner, having used the panel `semantic/9` shipped hours earlier: *"the basic
implementation is good, what i would like to improve: 1 - regex is complex and a regex help with
examples should be added, 2 - alternatives to regex A - wildcard character pattern matching in
expressions, also with help and examples, B - some logical ops the user could use especially if
supportd by sqlite like AND OR LIKE NEAR etc include examples of use, 3 Bold the count and other
numeric values you display"*.

`reports/2026-09-16-the-find-panel.md` is the round one this builds on. Nothing of its is
re-derived; every number of theirs that is used is cited to them. Every number below that is not
cited to somebody else is this lane's, and says how it was taken.

---

## THE ANSWER IN FOUR PARAGRAPHS

**The four ways of typing a query are a RADIO GROUP, not four checkboxes, and that is Notepad++'s
own shape.** `Plain words / Wildcards / AND OR NOT NEAR / Regular expression`, with `Match case`
and `Whole word only` as independent boxes beside them. `semantic/9`'s `Regular expression`
CHECKBOX became the fourth radio. Four tickable boxes would have been sixteen states, twelve of
which nobody has defined — which is the item's own prohibition, and it is also the
nine-checkbox failure `reports/2026-09-16-the-search-grammar.md` §5 named, arriving by the other
door.

**A WILDCARD IS NOT COMPILED TO A REGULAR EXPRESSION, and that is the single decision this lane
would defend hardest.** The obvious build translates `*` to `.*`; a regular expression reads the
text AS WRITTEN, so the mode advertised as *the simple one* would quietly find LESS than the plain
mode it is offered as an alternative to — `b*e...` would stop reaching `byte…`. So `*` and `?` are
matched by STITCHING the literal pieces, each found by the ordinary folded matcher, with the gaps
between them counted in code points. Two consequences follow. The pieces fold, so a wildcard is a
strict superset of the plain mode. And **the `(X+)+` refusal cannot fire in this mode at all**,
because there is no pattern to refuse — which the item asked for and which is stronger than
phrasing the refusal in wildcard terms would have been. Measured: the worst wildcard this lane
could construct, `a*a*a*a*a*a`, costs **389 ms** over 4,615 prose spans, against `^(\w+\s?)+$`'s
108,785 ms inside ONE.

**`AND` PAINTS BOTH TERMS, AND THE TWO COUNTS CANNOT DISAGREE** — the item's hard question,
answered in §3.2. A turn matches when the whole expression is true of it; every occurrence of every
term that made it true is painted; **turns are turns and times are ranges painted**, which are the
meanings they already had. They cannot drift, because `findInDocument` counts a turn when the range
list is non-empty and counts times as that list's LENGTH — one list, both numbers.

**The numbers are bold everywhere, from one rule rather than from a list of places.** `lib/i18n.js`
marks a value slot whose substituted text is a number, so every sentence that names a quantity gets
it — the find count, the mark and You counts, `Match 3 of 33`, the record totals, in both languages
and in sentences nobody has written yet. It is a `data-num` ATTRIBUTE and not a class, and §6.3
records the gate that made that the right answer.

**The strip stayed shrunk: 338.30 → 230.53 px in English, 240.13 → 166.75 px in Hebrew, measured
again today.** §5.

---

# 1. THE MODE SHAPE, AND WHY IT IS A RADIO GROUP

The item: *"Notepad++ … does NOT use checkboxes for this. It uses a RADIO GROUP … Consider it and
say what you chose. What must NOT happen is four checkboxes tickable in combinations nobody
defined."*

**Chosen: a radio group of four, with the two existing checkboxes beside it.**

```
  How to read what you typed          ← <div role="radiogroup">, one legend
    ( ) Plain words
    ( ) Wildcards — * and ?
    (o) Words joined by AND OR NOT NEAR
    ( ) Regular expression

  Both of these apply whichever of the four you choose
    [ ] Match case   [ ] Whole word only
```

**Why this and not a fifth checkbox.** "How do I read this string" has exactly ONE answer at a
time. "Does case count" and "must a match begin and end at a word boundary" are different
questions, and they are true or false independently of which reading is in force. That is precisely
the line Notepad++ draws — `Normal / Extended / Regular expression` as radios, `Match case` and
`Whole word` as boxes — and it is the line this panel now draws.

**What it cost.** `semantic/9`'s `Regular expression` checkbox is gone as a checkbox; it is the
fourth radio, with the same string (`conv.find.re`) and the same behaviour. `.mcoptre` no longer
exists as a selector and `e2e/conversations-find-panel.spec.ts` names `.mcmoderegex` instead.

**The one promise this makes about the page, said out loud rather than left implicit.** Radios
group by `name` within a document, so unlike every other control on this screen these cannot avoid
naming something page-wide (`mcfindmode`). It is safe because the panel is built once per mounted
document screen and this shell mounts one at a time. It is written into `screens/conversations.js`
so that a second conversation screen on one page — if one is ever built — finds the reason stated
instead of two groups quietly sharing a selection.

**`MODES` is one list, in `fold.js`.** The panel's radios are built from it, `core/conversation-
search.ts` re-exports it as `FIND_MODES`, and the route validates `?mode=` against it. A fifth mode
is a fifth radio with nothing else to remember.

---

# 2. WILDCARDS — WHAT THEY MEAN AND WHAT THEY COST

## 2.1 The grammar, and it is two characters

`*` is any run of characters including none. `?` is exactly one character. `\` escapes either.
Everything else is itself. **Unanchored**: what you type is looked for anywhere inside a turn.

**A `?` is ONE CODE POINT and not one UTF-16 unit**, so `a?b` matches `a😀b`. That is the same unit
`semantic/8`'s `precise` flag is about, and it is pinned by a fixture rather than assumed.

**A leading or trailing `*` paints nothing**, and that had to be decided. The match is unanchored,
so a star at either end asks for text that is already allowed to be there: `*byte*` and `byte`
return the same count and paint the same ranges. A star that swallowed the rest of the turn would
paint the whole turn for a query about one word. **A leading or trailing `?` is different and does
count** — it requires a character and paints it, so `?byte` finds ` byte` and not a turn that opens
with `byte`.

**A pattern with no literal at all is answered rather than refused.** `*` alone is the whole turn;
`???` is every window of three characters, which is what regex `.{3}` means and is the same honest
answer.

## 2.2 WHY IT IS NOT A REGULAR EXPRESSION, WHICH IS THE WHOLE OF THE MODE

The item expected a translation — *"It will likely translate to a regular expression underneath,
which means THE BACKTRACKING REFUSAL APPLIES TO IT TOO"*. It was refused, on two grounds:

**1. A translation loses the folding, which makes the simple mode find LESS than the plain one.**
A regular expression reads the text as written — that is `conv.find.reFold`, already on the screen —
so a translated `b*e...` would stop reaching the `…`, `‑`, `≠` and `µ` this product writes and a
keyboard does not. `semantic/8` measured 806 of 11,251 archive spans changing under NFKD. A mode
offered to a reader who *"does not want a language"* that quietly returns fewer results than the
mode they were already using is the worst of the three available outcomes.

**2. The refusal would then be about a shape a reader cannot type.** `nestedQuantifier` refuses a
repeated group whose body holds an unbounded repeat. A wildcard has no groups, so a translation
could only ever produce `.*.*.*` — polynomial, not exponential — and the reader would be shown a
refusal about a regular expression they never wrote, which the item forbids in as many words.

**So a wildcard cannot be refused for its shape, and that is asserted rather than argued.**
`*a*a*a*a*` runs. `(a+)+b` typed into this mode is six literal characters and finds the text
`(a+)+b`. The browser suite asserts the refusal note stays DOWN.

## 2.3 What it costs, on this repository's own session

`GET /api/conversations/595db3b1…/find`, live session, 2026-09-16, **4,615–4,624 prose spans**
(the session grew during the lane — 16,058 sections at the start of it and 16,195 at the end, which
is why the `semantic/9` numbers and these do not line up to the unit). `ms` is the scan alone, as
the endpoint reports it.

| query | mode | ms | turns | times |
|---|---|---:|---:|---:|
| `byte offset` | plain | — | 38 | 53 |
| `...` | plain | — | 461 | 1,428 |
| `שורה` | plain | — | 11 | 21 |
| `*.ts` | wildcard | **57** | 826 | 5,591 |
| `semantic/?` | wildcard | — | 25 | 39 |
| `reports/2026-09-16-*.md` | wildcard | — | 10 | 14 |
| `b*t...` | wildcard | — | 55 | 76 |
| `b*t offse?` | wildcard | — | 3 | — |
| `a*a*a*a*a*a` | wildcard | **389** | 3,519 | — |
| `*e*e*e*e*e*` | wildcard | **412** | 4,315 | — |
| `budget AND ms` | logical | **72** | 246 | 1,927 |
| `budget NEAR ms` | logical | **58** | 40 | 102 |
| `budget NEAR/400 ms` | logical | 64 | 150 | — |
| `"byte offset" OR "prose span"` | logical | 100 | 44 | — |
| `regex NOT wildcard` | logical | — | 70 | 96 |
| `\d+ ms` | regex | — | 183 | 711 |
| `[\w.-]+@[\w.-]+` | regex | — | 16 | 30 |
| `(\d{4})-(\d{2})-(\d{2})` | regex | — | 433 | 901 |
| `^(\w+\s?)+$` | regex | 0 | — | **refused, 0 spans read** |
| `\` | wildcard | 49 | 410 | — |

**The two stress rows are the bound this mode has instead of a refusal.** `a*a*a*a*a*a` is six
pieces over a transcript whose spans are full of `a`, and it is **389 ms** — 6.8x the plain scan and
280x cheaper than the pattern that had to be abandoned. The work is bounded by (occurrences of the
first piece) × (number of pieces), which is polynomial and has no backtracking engine in it. The
between-span time budget (`FIND_REGEX_BUDGET_MS`, 5,000 ms) was **widened from regex-only to every
mode but the plain one**, and §8.4 says why that is a decision rather than a tidy-up.

**`\` alone is a literal backslash — 410 turns.** A removal proof found that out: a first draft
refused a wildcard with no literal, no `*` and no `?` as `empty`, and the branch is unreachable,
because a lone `\` escapes nothing. The guard was deleted rather than left standing as a branch no
proof could reach.

---

# 3. THE LOGICAL OPERATORS

## 3.1 THE FACT THAT DECIDES THIS, AND IT IS NOT WHAT HE ASSUMED

He asked for them *"especially if supportd by sqlite"*. **THIS SURFACE NEVER TOUCHES SQLITE.**
`findInDocument` scans every prose span in JavaScript, deliberately, on two measurements
`semantic/8` and `semantic/9` took and this lane did not re-derive: the FTS5 index is UNFOLDED, so
it cannot see that `...` matches `…` (463 spans against 1,024), and FTS5 cannot return in-document
offsets at all — `offsets()` answers *"unable to use function offsets in the requested context"*.

**So the operators are implemented IN THE SCAN, and that is better here rather than a downgrade.**
An operator written in the scan composes with `Match case` and with the NFKD folding; an FTS5
operator would compose with neither. `conv.find.logNote` and its neighbours say so, so that a reader
is never left believing they are typing SQL.

**The other box — the archive search across all sessions — is the one that uses FTS5**, and it
already reads one query three ways in tiers. None of that is duplicated here;
`reports/2026-09-16-the-search-grammar.md` §4 measured that none of it transfers unchanged.

## 3.2 WHAT A HIT IS — the item's hard question, answered

*"Under `AND` a TURN matches but no single range does. Decide and state: does `AND` paint both terms
wherever they occur, and does the count count TURNS or OCCURRENCES? The panel draws both numbers
today and they must not start disagreeing."*

  — **`AND` paints BOTH terms, wherever in the turn they occur.** Painting neither would leave a
    reader looking at a turn with no colour in it; painting only the first would answer a query
    nobody typed.
  — **Turns are turns that MATCH. Times are RANGES PAINTED.** Both keep the meanings they had in
    every other mode.
  — **They cannot come apart**, and the reason is structural rather than careful: the matcher
    returns ONE list of ranges per span, `findInDocument` counts a turn when that list is non-empty
    and counts times as `list.length`. There is no second computation to disagree with the first.
    Measured on the live session: `budget AND ms` is **246 turns and 1,927 times**, and every one of
    those 1,927 is a range the browser paints.
  — **A term under `NOT` paints nothing**, and that needs no rule: it is not in the turn. That is
    what made the turn match.
  — **`NEAR` paints only the occurrences that are actually near one another**, not every occurrence
    of both. Measured: `budget AND ms` is 246 turns and `budget NEAR ms` is **40**; `budget
    NEAR/400 ms` is 150, so the distance is doing real work in both directions.

## 3.3 The grammar

`AND`, `OR`, `NOT`, `NEAR`, brackets, `"a phrase in quotes"`, and **juxtaposition meaning `AND`**,
which is FTS5's own spelling. `OR` binds loosest, then `AND` and `NOT` (which is `AND NOT`), then
`NEAR`, then a term or a bracket. Each OPERAND is read as ordinary text — the same folded matcher
the plain mode uses — so `Match case` and `Whole word` mean here exactly what they mean there, and
`... AND dots` still finds the `…`.

**An operator is an operator only in CAPITALS**, which is FTS5's rule and is what lets a reader look
for the word `and` at all. `conv.find.logNote` says so in one clause.

## 3.4 `NEAR`'s UNIT IS CHARACTERS, AND THE NUMBER IS 30

Default **30 characters between the two**, `NEAR/120` to change it, 1 to 4,000 the legal range.

**That is the same number AND the same unit as the archive search's second tier, `NEAR(…, 30)`, and
that is not a coincidence.** The item carried the measurement this rests on: under the TRIGRAM
tokenizer FTS5's `NEAR` distance is counted in CHARACTERS rather than in tokens — undocumented
upstream and measured by this project — so the tier over there has always meant characters too. Two
surfaces spelling `NEAR` and meaning two different units would be worse than either choice.

A **character** is a code point, not a UTF-16 unit. That needed its own fixture and §6.1 records
why: a removal proof that switched the counting to units reddened only a WILDCARD assertion,
because every NEAR fixture was ASCII, where the two agree.

## 3.5 JUDGED ONE BY ONE, INCLUDING THE ONE THAT WAS REFUSED

The item: *"He named AND, OR, LIKE, NEAR. Judge each on whether it MEANS anything here and say so
either way."*

  — **`AND` — shipped.** It means "this turn holds both", which is a real question on a document
    where a turn is the unit.
  — **`OR` — shipped.** A union and not a sum, which the numbers show:
    `"byte offset"` is 38 turns, `"prose span"` is 8, and `"byte offset" OR "prose span"` is **44** —
    two turns hold both.
  — **`NOT` — shipped**, as a binary `A NOT B` (FTS5's spelling), because a unary `NOT B` over a
    document means "every turn that does not hold B", which on this archive is 4,500 turns and is
    not a search.
  — **`NEAR` — shipped**, with its unit said every time it is drawn. §3.4.
  — **`LIKE` — REFUSED BY NAME, and this is the answer rather than a gap.** `LIKE` is SQL's
    WILDCARD: `%` for any run, `_` for one character. That is the Wildcards mode above under another
    spelling, and shipping both would be two grammars for one idea with a promise to keep them in
    step for ever. Typing it is answered by name (`why: 'like'`) with a sentence that points at the
    mode that already does it, rather than being read as a word to search for. The sentence also
    says the thing he was owed: *"this search never reaches SQL"*.

## 3.6 A query the grammar cannot read is its own answer

Six codes, each with its own sentence in both languages: `like`, `quote` (an unclosed quotation
mark), `paren` (unbalanced brackets), `operand` (`byte AND` with nothing after it), `empty` (`""`),
`nearRange` (a distance outside 1–4,000).

**A CODE and never a sentence, and that is load-bearing.** `fold.js` has no string table and must
not grow one: the words have to exist in Hebrew and English and the matcher runs in two runtimes.
The panel owns the words; an unknown code draws NOTHING rather than a placeholder, because a newer
server talking to an older page is a real shape here and an English key on a Hebrew screen would be
worse than silence.

**And a query that could not be read SCANNED NOTHING**, so the cost sentence stays down beside it —
the same rule `semantic/9` wrote for a pattern that would not compile. `nothing-to-do-and-could-
not-look-are-different-answers`, now with six doors on one side of it.

---

# 4. THE HELP, AND EVERY EXAMPLE IN IT WAS CLICKED

A `<details>` inside the panel, **shut until it is asked for** — a reader who knows the mode does
not want six examples between the box and the count, and a reader who does not has nowhere else to
find out. Its summary names the current way of typing; its body is rebuilt when the mode changes and
its OPEN state is not touched, so a reader who opened it goes on reading rather than being asked to
open it again.

**Each example is a real `<button>`. Clicking it puts the query in the box and runs it** — the
item's own requirement — and being a button rather than a styled span means a reader stepping the
panel with a keyboard has the same capability as one with a mouse.

## 4.1 The fifteen examples, every one clicked and run against his own archive

Driven by hand in Chromium against the live 139 MB session on this lane's own server. Each row is
the example's own button, actually clicked, and what the panel then said.

```
  MODE       EXAMPLE                          ANSWER
  ──────────────────────────────────────────────────────────────────────────
  plain      ...                              461 turns, 1,428 times
  plain      byte offset                       38 turns,    53 times
  plain      שורה                              11 turns,    21 times
  wildcard   *.ts                             826 turns, 5,591 times
  wildcard   semantic/?                        25 turns,    39 times
  wildcard   reports/2026-09-16-*.md           10 turns,    14 times
  wildcard   b*t...                            55 turns,    76 times
  logical    budget AND ms                    246 turns, 1,927 times
  logical    "byte offset" OR "prose span"     44 turns
  logical    regex NOT wildcard                70 turns,    96 times
  logical    budget NEAR ms                    40 turns,   102 times
  regex      \d+ ms                           183 turns,   711 times
  regex      [\w.-]+@[\w.-]+                   16 turns,    30 times
  regex      (\d{4})-(\d{2})-(\d{2})          433 turns,   901 times
  regex      ^(\w+\s?)+$                      REFUSED — the refusal, on purpose
  ──────────────────────────────────────────────────────────────────────────
```

**`\d+ ms` is 183 turns and 711 timings, which is the item's own standard** — *"`\d+` matches
digits teaches nothing; `\d+ ms` finds every timing this session printed is worth reading."* Not one
example here is a textbook one; each was typed into this panel before it was written down.

**One example was replaced because it proved nothing.** `"byte offset" OR "code unit"` returned
exactly the same 38 turns as `byte offset` alone — `code unit` is nowhere in this archive — so the
example was a union that demonstrated no union. `"prose span"` (8 turns) replaced it, and the OR is
44 rather than 46, which shows both the union and the overlap.

## 4.2 THE LAST REGEX EXAMPLE IS THE SHAPE THAT IS REFUSED, AND THAT IS THE POINT

The item: *"The help must also state the refusal that already ships … A reader who meets that
refusal should find out why in the help."*

So `^(\w+\s?)+$` is an example you can click, its caption says *"And the shape that IS refused —
click it to read why, in the panel"*, and `conv.find.helpReRefuse` above it carries the whole
measurement: the 108,785 ms, why no time budget can end it (the freeze is inside ONE turn, inside
the browser's pattern engine, which cannot be interrupted from the page), the canary that was
written and then measured to be unsound (2 ms over 4 words, 3,848 ms over 8, no return over 12), and
the narrowness of the refusal (`(\w+){1,3}` and `(foo|bar)+` both run). The browser suite asserts
that clicking it produces the refusal and not an error, and that `108,785` is in the help body.

The wildcard help carries the mirror sentence — `conv.find.helpWildSafe`, *"A wildcard can never be
refused for its shape"* — so a reader moving between the two modes is told the difference rather
than discovering it.

---

# 5. THE STRIP, MEASURED AGAIN

The item requires it. Taken by hand in Chromium against this lane's own server on port 58933, live
139 MB session, 1280×1000, `byte offset` in the box both times.

## 5.1 English

```
                        idle      with a query      with a query and the panel open
  .tvbar               62.58            62.58                             26.39
  .tvnav               60.78           162.75                            128.36
  chrome above well       —            338.30                            230.53
```

**107.77 px came back — 32%.** The end state, 230.53 px, is `semantic/9`'s own number to the
decimal. The BEFORE differs from their 372.69: the page above the strip has gained rows since (the
session is 135 MB and 466 lanes today against 139 MB and 459 then, and the header draws both), so
the shrink measured today is over a smaller starting figure. What is asserted in the suite is the
SHRINK rather than either number, for exactly this reason.

## 5.2 Hebrew

```
  .tvbar   28.19 ->  26.39
  .tvnav  117.56 ->  83.17
  chrome  240.13 -> 166.75
```

## 5.3 In the browser suite, both languages, 1280×720

```
  en   .tvnav 162.78 -> 128.38   .tvbar 62.59 -> 26.40   chrome 338.34 -> 230.56
  he   .tvnav  95.20 ->  60.80   .tvbar 28.20 -> 26.40   chrome 217.77 -> 144.38
```

Unchanged from `semantic/9`, which is the point: the radio group replaced a checkbox and the help
is inside the panel, so nothing this lane added is in the strip.

---

# 6. EVERY REMOVAL PROOF, AND WHAT REDDENED

**39 mutations, each applied alone and reverted, across four surfaces. Three reddened NOTHING on
the first run and all three are below with what was done about them** — a proof that reddens
nothing is the most valuable thing a run like this produces.

**THE HAZARD, STATED, because `reports/2026-09-16-the-find-panel.md` §5.4 asked the next lane to
state it.** Files under `src/ui/public/` are read LIVE FROM DISK by every running UI server,
including the owner's own on 58888. Two things were done about it. **The matcher's twenty mutations
ran against a COPY of the repository** in a temporary directory, so `fold.js` on disk was never
touched at all. The nine browser mutations do touch the shared files, and each window was ONE
filtered Playwright run — 10 to 25 seconds, against the ~25 minutes the previous lane's whole-file
runs took. Every file was restored after each mutation and again at the end, and the restoration was
verified by grep afterwards (§6.5).

## 6.1 THE THREE THAT REDDENED NOTHING, AND THIS IS THE SECTION TO READ

**1. `head.from < floor` in the wildcard stitcher reddened nothing, because it is DEAD CODE.**
Deleting it changed no answer. The reason is that after a hit is taken, the first-piece pointer is
advanced to the first occurrence at or past the hit's END, so a piece before the floor can never be
reached. What IS load-bearing is the check one line down — `start < floor` — because a LEADING `?`
moves the range's start BACK from the piece, so a piece past the floor can still produce a match
overlapping the one before it. The dead check was deleted rather than left standing as a branch no
proof could reach, and a fixture was added for the live one: `?ab` over `aabab`, where `ab` occurs
at 1 and at 3 and the second match would start inside the first.

**2. Counting NEAR in UTF-16 units instead of code points reddened a WILDCARD line and no NEAR
line.** Every NEAR fixture was ASCII, where the two units agree — the same trap `semantic/9`'s §5.2
recorded five times over, in its own words *"every case fixture was ASCII"*. It is the third lane in
a row to be caught by it on this file. Fixed with `a😀😀😀😀b`: four astral characters are four
characters and eight units, so `NEAR/5` reaches across them and a build counting units does not.

**3. The panel-fit assertion reddened nothing, because the browser fixture cannot see the
defect.** The new test asserts the panel does not run off the bottom of the screen; deleting the
height bound from `lib/panel.js` left it green. The cause is that in the e2e fixture the bar is
short and the panel opens near the TOP, where the static `calc(100vh - 4rem)` is already enough; on
the live session the bar is 284 px down and that is the whole defect. Fixed by dragging the panel
down first — as far as the frame's own clamp allows — which is the general statement anyway: a
panel the reader has dragged must stay on the screen.

**All three reddened after the fixtures were repaired**, and every table below is the re-run.

## 6.2 The matcher — `test/ui/fold.test.ts`, 20 mutations, against a COPY

```
   2  wildcard: `?` is read as `*` (every gap open)
   2  wildcard: the pieces are matched unfolded (a translation to RegExp, in effect)
   2  wildcard: a leading `?` is dropped instead of required and painted
   1  wildcard: a rejected hit consumes the text under it
   1  wildcard: whole word is never applied
   1  wildcard: the floor is checked on the PIECE rather than on the range start
   6  logical: AND paints only the left term
   1  logical: OR paints only the left side
   2  logical: OR matches only when BOTH sides are there
   1  logical: NOT is inverted
   1  logical: NEAR ignores the distance and behaves as AND
   2  NEAR and `?` count UTF-16 units rather than code points
   1  logical: an operator is recognised in any case
   1  logical: LIKE is read as a word to look for
   1  logical: overlapping ranges from two terms are both painted
   2  logical: a grammar failure is silent (`why` is never answered)
   2  logical: AND swallows OR, so the two stop having a precedence at all
   1  mode: an unknown mode falls back to the `regex` flag rather than to the plain scan
   1  mode: the default NEAR distance is not the archive search's 30
   9  mode: `regex: true` with no mode stops meaning the pattern mode
  ──────────────────────────────────────────────────────────────────────────
  20 of 20 reddened.
```

**Read the last row.** *`regex: true` with no mode stops meaning the pattern mode* reddens NINE
assertions, eight of which are `semantic/9`'s and were written before this lane existed. That is the
control on the whole compatibility claim: the four modes are new and the old spelling still means
what it meant, and nine lines say so.

**And read the second.** *The pieces are matched unfolded* is the mutation that IS the translation
to `RegExp` this lane refused, and it reddens the assertion the refusal exists for.

## 6.3 The server half — 8 mutations, all reddened

`test/core/conversation-search.test.ts` and `test/ui/conversation-document.test.ts`.

```
   2  [search] the mode is dropped and every query is the plain scan
   3  [search] the mode is echoed but not passed to the matcher
   1  [search] `why` is never served, so an unreadable query looks like one that found nothing
   3  [search] a query that could not be read still claims it read the spans
   2  [search] the mode is not echoed on the answer
   1  [route]  an unknown mode is accepted and quietly read as the plain scan
   1  [route]  `mode` is not in the route's declared vocabulary
   1  [route]  the mode is read but never passed on
```

## 6.4 The browser half — 11 mutations, all reddened

`e2e/conversations-find-panel.spec.ts`, each mutation run against the tests it should reach.

```
   2  [i18n]   the numeric mark is never set
   2  [i18n]   EVERY value slot is marked, number or not
   2  [css]    the weight rule is deleted, so the mark is drawn as nothing
   4  [screen] the mode is never sent, so it is a page-side filter
   2  [screen] the modes are four independent boxes rather than one group
   2  [screen] the help is not redrawn when the mode changes
   2  [screen] clicking an example fills the box but never runs it
   2  [screen] the refusal sentence for an unreadable query is never drawn
   2  [screen] the mode notes are never drawn
   2  [panel]  the height bound is not written on placement
   2  [screen] the find box has no direction of its own
```

**Read the second row.** *EVERY value slot is marked* is the control on the whole bolding rule: a
build that gave weight to every substituted value would satisfy every "is the number bold" line and
the only thing that catches it is the engine's own error message, which is a value slot and is not a
number.

**And read the fourth.** *The mode is never sent* is the virtualised-DOM defect this project
refuses, arriving as a plausible simplification: it reddens four tests in two languages, because
each of them counts over the whole transcript while fewer rows than that are drawn.

## 6.5 The restoration, verified

After every run: `grep -c` for each mutation's own marker across the four source files — `0` for all
of them — and the full 30-test spec re-run green on both engines afterwards.

---

# 7. THREE DEFECTS FOUND BY LOOKING, AND ONE BY A GATE

## 7.1 THE PANEL RAN 220 PX OFF THE BOTTOM OF THE SCREEN, AND THE COUNT WENT WITH IT

Found in the first screenshot taken after the help shipped, which is the second time on this panel
that an eye caught what sixteen green browser tests did not — §5.5 of round one is the first, a find
field 470 px tall.

`styles.css` bounds the panel with `max-block-size: calc(100vh - 4rem)`. **That bounds its HEIGHT
and not where its BOTTOM lands.** Opened 284 px down on the live session with the help open, the
panel was 936 px tall in a 1000 px viewport: it ended at 1220, and the match stepper and the count
line — the two things the reader came for — were 220 px below the edge of a `position:fixed` box
that does not scroll with the page. Unreachable, with nothing saying so.

A fixed element cannot be bounded against its own top in CSS, and the top is not a constant because
the reader drags this. So `lib/panel.js` writes the bound on every placement — open, drag and clamp
all arrive at one function — and the dialog's own `overflow:auto` scrolls what does not fit. After:
the panel ends at 984 in a 1000 px viewport and scrolls.

**This was `semantic/9`'s rule and not this lane's**, but the help is what made it reachable in the
ordinary case, and it is fixed here rather than filed.

## 7.2 THE FIND BOX DREW `b*t offse?` AS `?b*t offse` IN HEBREW

Found in the Hebrew screenshot. With the page RTL and the field carrying no direction of its own,
the field is RTL, and a trailing NEUTRAL resolves against the paragraph and is drawn at the far end.
The reader sees a pattern they did not type, in a mode whose whole subject is punctuation.

The field cannot be pinned LTR either — half this archive is Hebrew and a Hebrew query must read
right to left. `dir="auto"` reads the first strong character of the VALUE, which is the only thing
that knows. **`convanchfind`, the anchor search field one screen along, has always had it**, so this
is the house pattern arriving where it was missed rather than a new idea. The browser test asserts
BOTH directions on one field, so a build that pinned either one reddens.

## 7.3 THE `num` CLASS BROKE `screen-parity` ON SIX SCREENS, AND THE GATE WAS RIGHT

The first build of the bolding added a `num` CLASS to a numeric value slot.
`e2e/screen-parity.spec.ts` reads every visible element as `tag.class1.class2` and compares the
app's set against the design of record's — so `span.v.num` became a different KIND from the
`span.v` the mockup draws, and the gate reported `span.v` newly ABSENT on `simulate`, `injected`,
`watch`, `work`, `palette` and `packs`: six screens whose only value slot happens to hold a number.

**The gate was right and the class was wrong.** In this codebase a class names what a thing IS, and
a value slot holding a number is still a value slot; whether its text is a number is a STATE, which
is what a data attribute is for — `[data-f]` on the strip and `[data-p]` on a screen section are the
same shape. `data-num` it is, and `screen-parity` is green.

**The `typeof el.setAttribute === 'function'` guard beside it is not defensive programming**, and
the header says so: `lib/i18n.js` documents its `doc` as two methods wide, nineteen test files pass
a stand-in built to that contract, and requiring a third would break every one of them for a mark
that is purely presentational. `test/ui/viewmodel.test.ts` passes one that DOES carry attributes, so
the mark is asserted rather than assumed.

---

# 8. WHAT IS BOLD, AND WHY IT IS ONE RULE

His third ask: *"Bold the count and other numeric values you display"*.

## 8.1 The rule

`lib/i18n.js` marks a VALUE SLOT — `{name}` or `{mv:name}` — whose substituted text is a number,
and `styles.css` gives it `font-weight:600` and tabular figures. That reaches the find count, the
mark and You counts, `Match 3 of 33`, the record totals, the section counts, and every sentence in
either table that names a quantity, **including ones nobody has written yet**.

**Why in the renderer and not by editing the strings.** `{b:{turns}}` in a template would work, and
would have to be written into every sentence that names a quantity, in TWO string tables, for ever —
and the first sentence a later lane added without it would be the one that looked different. The
rule he stated is about the KIND of thing, not about a list of places.

## 8.2 What counts as a number, and it is deliberately narrow

Digits, with optional grouping separators, one optional decimal part, an optional sign and an
optional `%`. **Not** `3 ms`, **not** `v2.1.4`, **not** `2026-09-16` — a version and a date are
identifiers that happen to be spelt in digits, and bolding them would be weight spent on something
the sentence is not counting. Where a unit belongs to a number the unit is in the TEMPLATE
(`{ms} ms`), so the number bolds and the unit does not, which is what he asked for: *"the NUMBER,
not the sentence"*.

**600 and not `bold`.** The sans face here ships 400/600/700 and `bold` resolves to 700, which
against this body weight reads as a shout. And the colour is deliberately NOT changed: `--ink` is
what the sentence around it is, and a hue would be a sixth meaning colour on a screen whose five are
ruled at `styles.css` line ~1100.

## 8.3 Hebrew, checked on screen rather than assumed

The item: *"In Hebrew a bidi run around a bolded numeral is exactly where this goes wrong; check it
on screen."*

**It is safe because the mark goes on the SAME span that already carries `unicode-bidi: isolate`.**
A bolded numeral inside an RTL sentence is one isolated directional run whose weight changed and
whose boundaries did not — rather than a `<b>` wrapped AROUND the isolate, which would put a second
element boundary in the middle of a bidi run and is the shape that reorders digits and punctuation.

Driven and screenshotted. The Hebrew count line reads

> 38 מתוך 16160 קטעים מוצגים. 38 תורות של מילים מכילים את מה שהקלדתם, 53 פעמים — חיפשנו ב־4615
> תורות המילים שיש בתמליל הזה, מתוך 54965 רשומות.

with all six numerals bold, in their right places, the `־` prefix attached to the right one.
`reports/2026-09-16-the-find-panel-round-two-he.png` is the image.

## 8.4 One thing that is NOT bold, and it is a decision

The cost sentence's `{ms}` and `{scanned}` ARE bold; `108,785` inside `conv.find.reRefused` and
`conv.find.helpReRefuse` is NOT, because it is written into the sentence as prose rather than
substituted as a value. Those two are the only quantities on this panel drawn as literal text, and
they are a measurement being QUOTED rather than one being reported — the sentence is about a thing
that happened once, not about the query in the box. Recorded so the asymmetry reads as a choice.

---

# 9. WHAT MUST NOT REGRESS, AND DID NOT

  — **EVERY MODE IS IN THE SERVER SCAN**, through the one `findQuery` the count and the highlights
    share. Four mutations redden when the mode is left out of the request; the assertion is that
    each mode changes a count over the WHOLE transcript while fewer rows than that are drawn.
  — **The strip stays shrunk.** §5, measured again in both languages.
  — **Hebrew: `שורה` still finds the glued `השורה`** — 11 turns and 21 times on the live session in
    the plain mode, and `semantic/9`'s Whole-word sentence is unchanged. The new modes are equally
    honest: a wildcard's pieces fold exactly as plain words do, and a logical term IS a plain word.
  — **`semantic/9`'s panel still works byte for byte.** `regex: true` with no mode is still the
    pattern mode, `&re=1` is still read by the route, and the mutation that breaks that reddens nine
    assertions written before this lane.
  — **`searchArchive` and the conversations LIST are untouched.** `fold.js` is imported by exactly
    two callers and neither is that box.

---

# 10. FOUND AND DELIBERATELY NOT CHANGED

**1. `e2e/mark-hues.spec.ts` "the key is shown on the control" is RED ON HEAD, and it is not this
lane's.** It collects every `.tvnavstep` and asserts the set of `aria-keyshortcuts` is exactly
`['N','Shift+N','Shift+U','U']`. `semantic/8`'s find stepper added two more `.tvnavstep` buttons —
`Previous match` and `Next match` — which carry no key, so the set has been six entries since that
shipped. `git diff` over `screens/conversations.js` shows this lane touched neither button. The
assertion is over-broad rather than the code being wrong, and repairing another lane's gate is not
this lane's to do without being asked.

**2. `e2e/preview-gate-counts.spec.ts` is red on data drift.** It builds `new RegExp('Showing the
first 20 of ' + count)` from the API's raw number and the screen draws `1,067` with a thousands
separator. It fires for any count over 999; this workspace's corpus is 1,304 items.

**3. `e2e/anchors.spec.ts` — three tests expect a table AND a ruling to be auto-marked and only the
table is.** Unrelated to anything here (`fold.js` is imported by two files and neither is the anchor
grammar), and the working tree's own `docs/capabilities/05-anchors.md` diff records the ruling yield
falling from 299 to 40 — which is somebody's concurrent work, not a defect this lane can read.

**4. `e2e/screen-parity.spec.ts` fails as a LOAD failure, not a ledger failure**, on this machine:
*"preview: still fetching (3 `/api` reads in flight) after 25 samples over 10s — it was NOT
compared"*. The `span.v` regression §7.3 records IS fixed and gone from the report.

**5. `docs/capabilities/*.md` changed in the working tree during this lane and NOT by it** —
eight modified and three new files, all substantive prose about anchors, retrieval and the web UI.
Named here so the next reader of `git status` does not attribute them to `semantic/11`.

**6. `conv.find.reCost` was renamed `conv.find.scanCost` and its wording generalised.** It said *"A
pattern cannot use the index"*; three of the four modes read every span now, so it says *"There is
no index behind this box"*. The class it is drawn into went `mcnoterecost` → `mcnotecost` for the
same reason. The plain mode is the only one that does NOT draw it: it is the baseline, it has never
been slow, and a cost sentence on it would be a bound drawn on a screen that has never been
approached.

**7. `conv.find.logNote` says `{m:"}` and not `{m:"in quotation marks"}`, because a gate said so.**
`test/ui/strings-parity.test.ts` asserts that the text inside a monospace run is IDENTICAL in both
tables — it is an identifier, not prose — and the first draft had the English words inside the run.
The gate was right: what is monospace there is the quotation mark itself.

---

# 11. WHAT IS THE OWNER'S TO DECIDE

1. **`NEAR` is 30 characters by default and the unit is characters, not words.** §3.4 says the
   number is borrowed from the archive search's own tier so the two surfaces agree. If he wants
   words, it is a different implementation (a tokenizer this surface does not have) and a different
   answer to "what is a word" in Hebrew.

2. **Juxtaposition means `AND`.** `byte offset` in the operator mode is two words both of which must
   be present, NOT the phrase — FTS5's rule, and `"byte offset"` is the phrase. It is the one thing
   in this grammar a reader could be surprised by, `conv.find.logNote` states it, and it is his to
   reverse.

3. **`LIKE` is refused as the Wildcards mode under another name.** §3.5. If he wants the spelling
   anyway it is four lines, and the cost is two grammars for one idea.

4. **A wildcard cannot be refused for slowness and a pattern can.** The worst wildcard measured is
   389 ms; the residue `semantic/9` left open — ambiguous alternation, `(a|a)+` — is still open and
   still needs a killable child process or a linear-time engine, which is a dependency and is his to
   rule on. Nothing about that changed today.

5. **Three panels were asked for and one still exists.** Navigation and copy are two items. The
   frame gained one thing today — the height bound written on placement, §7.1 — which both of them
   will need.

---

# 12. FILES TOUCHED

**Changed:**

  — `src/ui/public/lib/fold.js` — `MODES`, `NEAR_CHARS`, `NEAR_MAX`, `PIECE_CAP`;
    `forwardCodePoints`, `backCodePoints`, `firstFrom`, `exactAt`; `wildcardItems`,
    `wildcardPlan`, `wildcardMatches`; `logicalTokens`, `logicalParse`, `nearPairs`,
    `logicalEval`, `mergeRanges`; `findQuery` rewritten around the four modes.
  — `src/ui/public/lib/panel.js` — the height bound written on every placement (§7.1).
  — `src/ui/public/lib/i18n.js` — `NUMERIC`, and `data-num` on a numeric value slot (§8).
  — `src/core/conversation-search.ts` — `FindOptions.mode`, `FIND_MODES` re-exported from the
    matcher, `DocumentFind.mode` and `.why`, the budget widened past regex.
  — `src/ui/read-model-conversation-document.ts` — the `mode` parameter, validated against
    `FIND_MODES`.
  — `src/ui/public/screens/conversations.js` — the radio group, the help and its examples, the
    new notes and the `why` table, `findOptions.mode`, `dir="auto"` on the find box.
  — `src/ui/public/styles.css` — `.v[data-num]`, `.mcpanelmodes`, `.mcpanelhelp` and its parts,
    the note on `.mcpanel`'s height floor.
  — `src/ui/public/strings/en.js`, `src/ui/public/strings/he.js` — 41 new keys under
    `conv.find.*`; `reCost` → `scanCost`; `options` re-headed and `modes` added.
  — `test/ui/fold.test.ts` — 25 tests over the two new modes and the mode dispatch.
  — `test/core/conversation-search.test.ts` — 4 tests over the scan's half.
  — `test/ui/conversation-document.test.ts` — 1 test over the route's `mode`.
  — `test/ui/viewmodel.test.ts` — the numeric mark and its control; the stand-in gained attributes.
  — `e2e/conversations-find-panel.spec.ts` — 7 new tests × 2 languages, and four fixture turns.

**New:**

  — `reports/2026-09-16-the-find-panel-round-two.md` — this file.
  — `reports/2026-09-16-the-find-panel-round-two.png` — the panel on the live session, English,
    operator mode, help open, `budget NEAR ms`.
  — `reports/2026-09-16-the-find-panel-round-two-he.png` — the same in Hebrew, wildcard mode.

---

# 13. GATES

```
  npm test                       8880 tests, 8877 pass, 0 FAIL, 3 skipped
  git status src/rules/entries/  EMPTY — the shipped rule store is unharmed
  npx tsc --noEmit               clean
  npm run check:basis            no test file outside the baseline is missing a basis or malformed
  npm run check:text-files       1441 text file(s), none holds a NUL byte
  npm run check:test-glob        the glob reaches all 591 test file(s)
  npm run check:dependencies     package.json declares no runtime dependency
  npm run check:vendor           28 vendored file(s) match VENDOR.md
  npm run check:retired          104 retired phrase(s), 0 still present in a body
  playwright chromium            30 passed — this lane's spec, 15 tests x 2 languages
  playwright chrome              30 passed — the same, in Google Chrome itself
  playwright chromium            43 passed — conversations-find, doc-actions, doc-navigation,
                                 bidi, docs-bidi: the neighbours that name `.tvfind`, `.tvnav`
                                 or a value slot
```

**`npm test` is 0 FAIL, which is worth naming.** Round one reported one failure —
`test/cli/rules.test.ts`, the `KNOWN-running-the-test-suite-can-leave-the-shipped-rule-store` race.
It did not recur in this lane's run, which is the signature that report described: *"which of the
two fails moves between runs"*. And `git status src/rules/entries/` printed nothing afterwards, so
the store this run left behind is the shipped one.

---

# 14. WHAT WOULD MAKE THESE NUMBERS WRONG

  — **A different session.** Every timing is 4,615–4,624 prose spans of one transcript, and that
    transcript grew by 42 spans while this lane ran. The scan is linear in the prose; the ORDER of
    the modes by cost is what is measured here, not the absolute figures.
  — **A wildcard whose first piece is rarer or commoner.** The stitcher's work is (occurrences of
    the first piece) × (pieces), so `a*a*a*a*a*a` at 389 ms is a worst case for THIS archive's
    letter frequencies and not a bound in general. What is a bound is that there is no backtracking
    engine in the path.
  — **A different V8.** Round one's 16x literal-versus-regex result is a property of this engine's
    prefilter and every number here is measured against the same one.
  — **A wider window.** Every strip height is 1280 px wide; the counts wrap differently elsewhere,
    and the suite asserts the SHRINK rather than the numbers.
  — **A Hebrew corpus.** The Hebrew rows are 11 turns and 21 times on an archive whose Hebrew is a
    handful of prompts plus this project's own UI strings. The MECHANISM is what is measured there;
    the traffic is not.
