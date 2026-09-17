Lane AT, `semantic/14` — `TASK-the-find-panel-s-counts-move-as-you-type-and-the-regex-mode`,
2026-09-17. The owner, having used what `semantic/11` shipped the evening before: *"looked at the
search dialog and you did it very weell, small improvements: pleaes put the counts it a statis
place up under the edit search expression and it would be nice to see them in blue so they would be
more observable, about regex - add more examples and also add a full syntax help because it is
complicated and hard to remember. taht's all and it will be perfect"* — and then, through the day,
four more: a stepper that *"stopped working after the first use"*, a button to clear the box, the
current match *"in focus so the user could see it"*, and a position counter that *"will become 2
then 3 etc' till 15 of 15"*.

`reports/2026-09-16-the-find-panel.md` (`semantic/9`) and
`reports/2026-09-16-the-find-panel-round-two.md` (`semantic/11`) are the two rounds this builds on.
Nothing of theirs is re-derived; every number of theirs that is used is cited to them. Every number
below that is not cited to somebody else is this lane's and says how it was taken.

---

## THE ANSWER IN SIX PARAGRAPHS

**The counts are the second thing in the panel, under a find box whose height is fixed, and
everything that changes height is below them.** Measured on the live session at 1280×1000: the
block's top is 303 px in English and 357 px in Hebrew, and it is the same pixel after a mode
change, an option tick, an opened help and a longer query — the four things that used to push it
down. §1.

**The blue is `--carry`, and that is the SECOND CASE OF A RULE THAT ALREADY EXISTS rather than a
hue being widened.** `styles.css` ~1490 states this product's three registers in as many words —
white *"this is a NAME"*, blue *"this is a FACT"* for every unlevelled value, hue *"this is a
VERDICT"* — and beside `.strip .ufield .uval`: *"its use here is NEUTRAL IDENTITY, never severity …
a blue value must not be read as a level."* A match count is an unlevelled value: forty turns is
neither good nor bad. **Measured 6.51:1 on the panel's own ground and 7.44:1 on the strip's**, both
clear of AA, against the 4.06:1 at which `--crit` was refused on a surface earlier in this
campaign. §2 — and §2.3 is the one thing in it the owner may want to rule on.

**The regular-expression reference is a 33-row lookup table in six sections, and its last row is
what the scan REFUSES.** Fifteen worked examples already shipped and he asked anyway, so the gap was
never another example: an example teaches the first use, a reference serves the fiftieth. The table
also carries the four things a general reference would get wrong here — the unit is a TURN, `^` and
`$` are that turn's ends, `Match case` is the `i` flag and there are no flag letters to type. §3.
**Nine regex examples now, five of them new, every one run against his own archive before it was
written down**, the smallest at 41 turns. §3.4.

**THE STEPPER BUG WAS NOT THE STEPPER.** Driven on a current server it walks 1 → 40 and back
perfectly. Driven under HIS condition — a page newer than the server answering it — it reproduces
his sentence exactly: the first use correct, and every press afterwards answering *"There is
nothing to step to."* **What that exposed IS a real defect and it is fixed**: a scan the server
REFUSED was being drawn as a measured zero. §4.

**The current match is now placed where the reader can actually see it, and "visible" is answered by
`elementFromPoint` rather than by a rectangle.** The panels float over the well, are draggable and
are remembered, so a match scrolled to underneath one is perfectly highlighted where nobody can look
at it. §5 — and the rule that landed is *the first band the scroll can actually reach*, which is a
Hebrew screenshot's finding.

**"1 of 15" is live, it counts back down, it stops at the end, and `semantic/12` now owns it.** The
counter was built here first and the navigation lane adopted it hours later as `drawPlace(which,
total)` for all three walks — one implementation, three callers, theirs to keep. §6 says which way
that fell and where the one implementation lives.

---

# 1. THE COUNTS GET ONE PLACE

## 1.1 What was wrong, as a measurement

`openFindPanel` built the body in this order:

```
  find  modeRow  optionsHead  optionsRow  help  findNotes  foundGroup  count  panelHint
```

The two numbers were LAST, under four groups that each change height as the reader works: a mode
draws two or three sentences of its own, an option draws another, a Hebrew query draws a fourth,
the help opens to nine examples. So they slid down the panel as he typed.

## 1.2 What shipped

```
  findRow  counts  modeRow  optionsHead  optionsRow  help  reference  findNotes  panelHint
            └── foundGroup, then count
```

`.mcpanelcounts`, directly under the field, with a hairline under it. Measured on the live session
at 1280×1000, tops in viewport pixels:

```
              find box   counts block   stepper   count sentence   mode radios
  English        271          303         307          360             452
  Hebrew         325          357         361          414             487
```

and the block's top is the SAME pixel after a mode change, an option tick, an opened help and a
longer query. The browser suite asserts it in both languages.

**THE STEPPER IS ABOVE THE SENTENCE AND THAT IS THE ORDER THAT MATTERS.** `.tvnavfounds` holds only
short lines; `p.tvcount` wraps to between one and four. The other order lets the long one push the
short ones about, which is the same defect wearing different clothes — and the removal proof for it
reddens **in Hebrew only**, because Hebrew's sentences are shorter and wrap at a different width.

**WHAT IS PINNED AND WHAT IS NOT, said exactly.** The block's top and the stepper's top are fixed
against everything below them, which is what he reported. The count SENTENCE's top is not fixed
against its own neighbour's text changing: *"This search could not be answered…"* is two lines where
*"40 turn(s) here hold what you typed."* is one, and no order of three stacked elements makes a
sentence that grew by a line not move what is under it. The suite bounds it at one line and reddens
at the 23 px it moves on a build where the notes were above the counts.

---

# 2. THE BLUE, AND WHAT `carry` MEANS BEFORE IT IS SPENT

## 2.1 The question the item actually asks

*"A MEANING HUE CARRIES A MEANING. Read what `carry` means in this product before spending it on a
count. If a count is not that meaning, SAY SO."*

`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` closes the budget at five and its
2026-08-27 amendment adds the rule that binds here: **a hue may narrow a group, never name one.**

## 2.2 What `carry` already means, quoted rather than inferred

`styles.css` ~1490, the strip's own three registers:

```
      white  "this is a NAME"     every label, always, uppercase
      blue   "this is a FACT"     every unlevelled value
      hue    "this is a VERDICT"  the four levels
```

and beside `.strip .ufield .uval`, in as many words:

> *"`--carry` … its use here is NEUTRAL IDENTITY, never severity. REPO, BRANCH, SESSION NAME, COST,
> CACHE and ELAPSED are never good or bad, and a blue value must not be read as a level."*

**A MATCH COUNT IS AN UNLEVELLED VALUE.** Forty turns is not good and not bad; there is no band it
falls into and nothing on this screen may read it as one. So this is the second surface of a rule
that already exists, not a new meaning for an old colour — the same move MODEL, REPO and the audit
clock's op already made, and the same ink the terminal gives them (`INK.carry`).

**And the amendment is satisfied**: the numeral is not asked to carry the fact by colour alone. It
is also 600 against the sentence's 400, and the sentence beside it names what it is a number of.

## 2.3 THE ONE THING THAT IS HIS TO RULE ON, AND IT IS NOT THE HUE

What is blue is the NUMERAL and not the sentence — the same `data-num` mark `semantic/11`'s weight
rule reads, so nothing new is marked and nothing is marked twice. But the blue is **scoped to the
document viewer's find counts** (`.tvroot p.tvcount`, `.tvroot .tvnavfoundcount`), and identical
`data-num` numerals elsewhere in the product stay `--ink`.

That asymmetry is a decision and he should see it:

  — **What shipped**: the find counts are blue, because that is what he was looking at.
  — **The alternative**: `.v[data-num]` app-wide, which is one line and would make every numeral in
    every sentence in the product blue. It is arguably the more consistent reading of *"blue is the
    ink of an unlevelled value"*. It is not this lane's to take: it changes every screen, and every
    ground those numerals sit on would need the contrast measured, not just these two.

**It follows the COUNT and not the PANEL.** `p.tvcount` and `.tvnavfoundcount` are lent to the panel
while it is open and go back to the strip when it shuts; scoping the colour to `.mcpanel` would
make one sentence blue in one place and grey in the other, which is a hue saying something about
where an element is standing.

## 2.4 The contrast, measured in the browser

Composited on a canvas rather than parsed, because the panel's own background computes to
`color(srgb 0.113725 0.113725 0.141176 / 0.94)` and no hand-written `rgb()` parser reads it.

```
  #8b9ce6 on the panel ground, measured (27,27,35)      6.51:1   AA
  #8b9ce6 on the strip  ground, measured (11,12,17)     7.44:1   AA
  the sentence around it, rgb(169,166,184)              7.20:1
```

Both clear AA for body text with room. The gate is real on this project: `--crit` was refused on a
surface at a measured 4.06:1.

---

# 3. THE REGULAR-EXPRESSION REFERENCE

## 3.1 Why a table and not a sixteenth example

*"it is complicated and hard to remember"*. Fifteen worked examples already shipped and he asked
anyway, so the thing that was missing was never another example. An example teaches the FIRST use of
a construct; a reference serves the fiftieth, when the reader knows exactly what they want and
cannot remember how it is spelt. The panel now has both instruments.

A second `<details>`, shut until it is asked for, **drawn for the pattern mode and no other** — `*`
is a wildcard's own star in one mode, `AND` is an operator in another, and in the plain mode every
character in that table is a character to look for. A syntax reference standing open beside a mode
that reads none of it would be the panel teaching a grammar the query is not being read with.

## 3.2 What it covers — 33 rows, 6 sections

```
  CHARACTERS                       abc  .  \.  .*+?^$|()[]{}\  \t \n  א
  ONE CHARACTER OUT OF A SET       [abc]  [^abc]  [a-z]  \d \D  \w \W  \s \S  \p{L} \p{N}
  HOW MANY OF THE THING BEFORE IT  a*  a+  a?  a{3}  a{2,4}  a{2,}  a+?
  WHERE IN THE TURN                ^  $  \b \B
  GROUPS, CHOICES AND WHAT STANDS  (a|b)  (?:ab)  \1  (?=ab) (?!ab)  (?<=ab) (?<!ab)
    NEXT TO THEM
  WHAT THIS SEARCH DOES WITH A     Match case   Whole word only   ^ $ .   \u{1f600}   m s   (X+)+
    PATTERN
```

**The left column is a construct and not a string key.** It is syntax, identical in every language,
so it lives in the table as a literal and is drawn into a `span.m` — monospace, `direction:ltr`,
`unicode-bidi:isolate`, the run every identifier on this screen already wears. Only the sentence
beside it is a key, so this is 33 keys per table and not 66.

## 3.3 WHAT THE LAST SECTION SAYS, AND IT IS THE HALF THAT MAKES IT HONEST

A reference listing a construct the scan rejects is worse than no reference. So the refusal is IN
the table:

> **`(X+)+`** — REFUSED BEFORE ANYTHING IS READ: a group that repeats and whose body itself repeats
> without a bound — `(a+)+`, `(a*)*`, `(\w+\s?)+`. One of those took **108,785 ms** inside a SINGLE
> turn of this archive and had to be abandoned, and no time limit can stop it, so it is refused
> instead of run. The refusal is narrow: `(foo|bar)+` and `[\w.-]+@[\w.-]+` both run, and so does a
> group repeated a bounded number of times.

and so are the four other things a general reference would get wrong on this surface:

  — **`^` is the start of the TURN, not of a line.** The scan reads one prose span at a time and
    never sets `m`, so a turn has exactly one start. `$` likewise.
  — **The unit is one turn.** A pattern can never reach out of the turn it is reading, and `.`
    never crosses a line break; `[\s\S]` is the spelling for any character at all.
  — **`Match case` is the `i` flag** and the only way to turn it off. There is no letter to type.
  — **There are no flag letters at all**, and the pattern is read one character at a time unless
    the browser refuses, in which case the panel says it dropped to UTF-16 units.

## 3.4 NINE EXAMPLES, FIVE OF THEM NEW, EVERY ONE RUN AGAINST HIS ARCHIVE

Taken through `GET /api/conversations/595db3b1…/find` against the live session on 2026-09-17,
4,656 prose spans. Every one was also CLICKED in the panel, in both languages.

```
  MODE       EXAMPLE                             TURNS    TIMES   TEACHES
  ────────────────────────────────────────────────────────────────────────────────────────
  regex      \d+ ms                               185      715    (shipped in semantic/11)
  regex      \d+(?= ms)                           185      715    NEW — a look-ahead: same
                                                                  turns, only the number painted
  regex      \b\d+(?:,\d{3})+\b                   534    1,892    NEW — a group that does not
                                                                  remember, and a bounded {3}
  regex      [\w.-]+@[\w.-]+                       16       30    (semantic/11)
  regex      (\d{4})-(\d{2})-(\d{2})              441      934    (semantic/11)
  regex      ^#{1,3} .+                            64       64    NEW — ^ is the start of a TURN:
                                                                  one match per turn, never per line
  regex      [֐-׿]+                      82      618    NEW — a range by code point
  regex      \b(\w+) \1\b                          41       57    NEW — a back-reference
  regex      ^(\w+\s?)+$                        REFUSED           (semantic/11 — on purpose, last)
  ────────────────────────────────────────────────────────────────────────────────────────
  wildcard   e2e/*.spec.ts                        130      306    NEW — a fixed head and tail
  logical    (carry OR gold) AND contrast          26       91    NEW — brackets group
  ────────────────────────────────────────────────────────────────────────────────────────
```

**And every example `semantic/11` shipped was re-run today** and still finds something — `...` 470
turns, `byte offset` 40, `שורה` 13, `*.ts` 840, `semantic/?` 26, `reports/2026-09-16-*.md` 14,
`b*t...` 56, `budget AND ms` 252, `"byte offset" OR "prose span"` 48, `regex NOT wildcard` 74,
`budget NEAR ms` 43. The standing rule holds: an example that finds nothing teaches nothing.

**`\d+ ms` and `\d+(?= ms)` are the same 185 turns and are the point of the pair.** The second
paints the number and leaves the unit alone, which is what a look-ahead IS, and a reader can see the
difference on their own screen rather than take it on trust.

---

# 4. THE STEPPER BUG — REPRODUCED, AND IT WAS NOT THE STEPPER

## 4.1 On a current server it is correct

This lane's own server, live 139 MB session, `byte offset`, six presses of Next and three of
Previous:

```
  before: top 0                     said ""
  next 1: top 0     now-range 1     Turn 1 of 40 that holds what you typed.
  next 2: top 996   now-range 1     Turn 2 of 40
  next 3: top 1603  now-range 1     Turn 3 of 40
  next 4: top 2708  now-range 1     Turn 4 of 40
  next 5: top 3084  now-range 1     Turn 5 of 40
  next 6: top 3537  now-range 1     Turn 6 of 40
  prev 1: top 3084                  Turn 5 of 40
  prev 2: top 2708                  Turn 4 of 40
  prev 3: top 1603                  Turn 3 of 40
```

Exactly one `mycontextfindnow` range at every step. **It does not reproduce.**

## 4.2 Under HIS condition it reproduces exactly, and the cause is on the record

His server on 58888 started **2026-09-16 16:06:35**. `git log` on the server's own modules:

```
  5211551d  2026-09-16 20:42:04   four ways to read a query          (semantic/11)
  b066059d  2026-09-16 18:43:06   the find options he asked for      (semantic/9)
  82397eb2  2026-09-16 14:28:04   a turn wears two hats              ← his frozen build
```

`git show 82397eb2:src/ui/read-model-conversation-document.ts` — the find route's whole vocabulary
on that build is **`unknownParams(url, ['q'])`**. The browser assets under `src/ui/public/` are read
live from disk on every request and a server's own modules are frozen at start, so **his page was
today's and his scan was yesterday's**: `case`, `word` and `mode` were each a `400` from it.

Reproduced by intercepting the route to answer what that server would have answered — nothing in
the repository touched:

```
  plain find, then three steps
    next 1  Turn 1 of 40 …   stepper "40 turn(s) here hold what you typed."
    next 2  Turn 2 of 40 …   stepper "40 turn(s) here hold what you typed."
    next 3  Turn 3 of 40 …   stepper "40 turn(s) here hold what you typed."
  now he ticks Match case — which his server has never heard of
    [400 for q=byte offset&case=1]
    stepper "No turn here holds what you typed."          ← over a query that holds forty
    next 1  "There is nothing to step to. Type in the find box first."
    next 2  "There is nothing to step to. Type in the find box first."
    next 3  "There is nothing to step to. Type in the find box first."
  and untick it again
    next 1  Turn 1 of 40 …   ← it repairs itself, which is why it looked intermittent
```

**That is his sentence, line for line**: *"the next match and preious match stopped working after
the first use that was correct"*. And it is the SECOND diagnosis this split has cost — *"Next match
doesn't scroll"* was the same thing the day before. The one-line recognition for the next reader:
**if the page has features the answers do not, the server is older than the page; restart it.**

## 4.3 WHAT IT EXPOSED IS A REAL DEFECT, AND IT IS FIXED

`askFind`'s `catch` cleared `foundAt`, so `foundStops()` was empty, so the screen drew a MEASURED
ZERO over a scan that had never run. `nothing-to-do-and-could-not-look-are-different-answers` is the
rule that was broken, and it was broken by a state that did not exist: the page could tell *"the
scan answered no"* from *"the scan has not answered yet"* (`findBody === null`) and could tell
neither from *"the scan REFUSED"*.

`findFailed` is that third state, and it draws three sentences in three places a reader might be
looking:

```
  the panel       conv.find.scanFailed      "This search could not be answered, so nothing was
                                             searched for and no number below is a count of
                                             anything. If this page was updated while the server
                                             was running, the server is older than the page … stop
                                             it and start it again with `mycontext ui`."
  the stepper     conv.nav.foundsUnknown    "This search could not be answered, so nothing here
                                             has been looked at."
  a press of Next conv.nav.noFoundsFailed   "There is nothing to step to because this search could
                                             not be answered — not because nothing was found."
```

Re-run against the same interception afterwards: all three appear, and all three come down again
the moment a query is answered.

**The owner has since confirmed it on a server restarted at 10:26 and reports both buttons working.**
The stepper was never the defect; the silent zero was.

---

# 5. THE CURRENT MATCH, AND WHAT "IN FOCUS" HAD TO MEAN

*"when you highlite the current match, verify it is in focus so the user could see it"*.

## 5.1 The question is not "did it move"

Stepping already scrolled — §4.1 is 0 → 996 → 1603 on two presses. **Landing is not the same as
being visible**, and the only test that answers the difference is `document.elementFromPoint` at the
middle of the match: it returns the TOPMOST element, so a match under a panel answers with the
panel. Every measurement below is that test.

## 5.2 What was hiding it

`showMatch` aimed into `.tvscroll` ∩ the viewport. That was already one correction deep — the
header records that the well's own box runs past the bottom of the window — and it knew nothing
about the three floating panels, which are non-modal, draggable and REMEMBERED, so one sits over
the well wherever the reader last left it. Measured on the live session with the panel dragged over
the middle of the well, before the change: **two of five landings put the match under the panel.**

## 5.3 The rule that shipped, and it took three readings to get right

  1. The panels that cover this match's COLUMN are subtracted from the visible strip, leaving a
     list of bands.
  2. Bands smaller than the match itself are dropped.
  3. The rest are ordered by size, and **the first one the scroll can actually REACH wins**.
  4. The margin is clamped to half of what the band has to spare.
  5. If nothing reachable is left — a panel taller than the well, three of them stacked — the old
     rule is used, and the reader drags the panel aside, which is the affordance it has.

**Step 3 is a Hebrew screenshot's finding and it is the one worth reading.** A first draft took the
LARGER slice. It passed in English and reddened in Hebrew on the same build: the match was 147 px
down a well running 117–621, the panel covered 150–573, the larger slice was the 48 px BELOW it —
and reaching that slice meant scrolling UP from `scrollTop` 0. The write was clamped to 0, nothing
moved, and the match stayed under the close button. The 33 px above the panel is the smaller slice
and the only reachable one.

**Step 1 needed a second correction of the same shape.** The range `showMatch` aims with is
COLLAPSED to the match's start, which is right for the scroll and wrong for a column test: a point
has no width, and a match starting at x 419 beside a panel at 444 was read as clear of a panel its
second half was behind. The same two offsets `paintFinds` paints with are used again for the
column, so the answer is the rectangle the reader sees.

## 5.4 Measured, both languages, both panel positions

Live session, 1280×1000, five steps each, `elementFromPoint` at the middle of the current match:

```
                                   before        after
  panel where it opens, English    5 of 5 clear  5 of 5 clear
  panel dragged over the well, en  3 of 5 clear  5 of 5 clear
  panel where it opens, Hebrew     —             5 of 5 clear
  panel dragged over the well, he  —             5 of 5 clear
```

and in the browser suite, in both languages, with the panel dragged over the well and then twice
more into the two geometries §5.3 names.

## 5.5 THE CARET, ANSWERED DELIBERATELY

*"'In focus' may also mean the caret."* **It does not move, and that is the screen's existing
discipline rather than an omission of it** — `step`'s own header: a step destroys nothing, the
button is still there and still focused, and a reader stepping through twelve matches presses it
twelve times. Moving the caret into the well would cost a walk back to the panel for every step and
would land it on a row `paint` evicts on the next one. What the reader is owed instead is to be
TOLD where they landed, and `navSaid` — outside the well, live, never rebuilt — is where that is
said. The panel's focus hand-back in `lib/panel.js` is untouched.

---

# 6. "1 OF 15", AND WHO OWNS IT NOW

## 6.1 It is live, and it counts both ways

*"when the user clicks the next match for example, the 1 will become 2 then 3 etc' till 15 of 15,
the same but decrease for previous match"*. Driven on the live session:

```
  before any step   "Press Next match to walk them."
  next 1..4         "You are on 1 … 2 … 3 … 4 of the 40 turns that hold it."
  prev 1..2         "You are on 3 … 2 of the 40 turns that hold it."
```

and walked to the end of a 14-stop query:

```
  next 14   "You are on 14 of the 14 turns that hold it."
  next 15   "You are on 14 of the 14 turns that hold it."   said: "Nothing after this point holds
  next 16   "You are on 14 of the 14 turns that hold it."    what you typed. This is the last
  next 17   "You are on 14 of the 14 turns that hold it."    match, and it is still where you are."
```

## 6.2 THE THREE THINGS THAT HAD TO BE DECIDED

**WRAP-AROUND: THE EARLIER REFUSAL STILL HOLDS, and the counter strengthens it rather than
reopening it.** `semantic/9` refused wrap with the reason *"wrap is a property of a caret that must
keep moving; a stepper that names the end is the honest version of it"*. That was written when
there was no counter — and a counter makes the end EXPLICIT rather than ambiguous: `14 of 14` beside
*"this is the last match"* is the same fact said twice, which is what the refusal wanted. A wrap
would now contradict a number on the screen as well as a sentence. It is asserted, and the mutation
that adds wrapping reddens.

**WHERE IT STARTS: nothing, in words.** Not `0 of 15` — there is no zeroth match, and a reader
reading it as a position would be reading one that does not exist. Not `1 of 15` — that claims he is
standing somewhere he has not gone, and the first press would take him to `2` having skipped one. It
says *"Press Next match to walk them."*, which is the one thing a reader at no position can usefully
be told, and it is a measured-zero distinction rather than a cosmetic one.

**WHEN THE SET CHANGES UNDER HIM: the walk is given up, not carried across.** `15 of 15` becoming
`15 of 3` is the bug shape, and it cannot happen because the counter reads `cursor.found`, which
`endWalk` resets — and `endWalk` is reached by every change of query, mode, option and filter
through `navRefresh`, and by the reader scrolling the well by hand. Driven: ticking Match case,
changing a mode radio, typing another character and pressing Clear each take the position down to
the idle sentence, with the total beside it already showing the new number.

## 6.3 WHAT IT COUNTS AGAINST — TURNS, AND THAT IS A MEASUREMENT

The coordinator's note said *"stepping walks matches, so almost certainly the times"*. **It does
not, and the code is exact about it:** `foundStops()` returns one stop per TURN (`foundAt` is keyed
by node index), and `showMatch` scrolls to `asked.find(whole, 1)[0]` — the FIRST match inside the
turn it landed on. A turn holding four occurrences is one stop and the other three are not reachable
by these two buttons at all.

So the sentence says `turns` in as many words: *"You are on 3 of the 40 turns that hold it."* — on a
query the panel above also reports as 56 times.

**AND `conv.nav.atFound` WAS WRONG ABOUT THIS AND IS REPAIRED.** It said *"Match {n} of {total}"*
over a total that is turns, beside a panel reporting 40 turns and 56 times — one word claiming a
walk the feature does not have. It now reads *"Turn {n} of {total} that holds what you typed."*
`e2e/conversations-find.spec.ts` reads the two NUMBERS out of that sentence and is unaffected.

**THE OWNER'S TO DECIDE: a walk over occurrences is a different feature, not a label change.**
Making Next reach the second and third match inside one turn needs per-match offsets the scan does
not return — `DocumentFind.turns[]` carries a byte offset and a COUNT. It is a real thing to want
and it is on his list, not smuggled in under a counter.

## 6.4 WHO OWNS THE IMPLEMENTATION, WHICH THE COORDINATOR ASKED TO BE SAID

**`semantic/12` owns it.** This lane built the counter for the match walk first and named the
element, the class and the strings; the navigation lane adopted it hours later and generalised it to
`drawPlace(which, total)` with a `PLACE_SLOT` table, called from `step` and `navRefresh` for all
three walks — marks, messages and matches. Their own comment says so.

**So this lane DELETED its own copy** rather than leave two implementations of one thing standing.
`drawFoundPlace` is gone; `foundPlace` (the element) remains and is what `PLACE_SLOT.found` points
at; `conv.nav.place` and `conv.nav.placeIdle` remain and are the sentences their `drawPlace` draws
for the match walk. That is the coordinator's rule — *"if they land first, adopt theirs rather than
writing a second"* — applied in the direction it actually fell.

---

# 7. THE CLEAR BUTTON

`button.convclear.mcpanelclear` beside the field, carrying `conv.filter.clear`. **The archive search
one screen along has had one since it shipped**, so this is the house pattern arriving where it was
missed rather than a control invented here: same class, same key, same `type="button"`.

It does what a keystroke would do without the 250 ms settle — `applyFilter`, `askFind`,
`drawFindNotes`, in that order, which is the same trio the help examples already use. Driven:

```
  the box            ""                 (was "conv.find.helpReRefuse")
  the highlights     0                  (mycontextfind emptied)
  the total          "Nothing is being looked for yet."
  the position       ""                 (no walk, no place)
  the caret          .tvfind            (not the button)
```

**The caret is deliberate and is not the frame's problem.** `lib/panel.js`'s `fallbackFocus` is
about a CLOSED panel; the panel is still open here, and a reader who cleared the box is about to
type in it. Nothing here re-solves what the frame already solves.

---

# 8. THE STRIP, MEASURED AGAIN — AND IT MOVED FOR SOMEBODY ELSE'S REASON

Live session, 1280×1000, `byte offset` in the box.

```
                           idle     with a query   search panel open   + navigation panel
  English  .tvbar          62.58        62.58            26.39               26.39
           .tvnav          99.17       185.34           128.36                0.00
           chrome         237.53       342.30           211.94               83.58
  Hebrew   .tvbar          28.19        28.19            26.39               26.39
           .tvnav          64.78       162.75           105.77                0.00
           chrome         168.75       285.31           189.34               83.58
```

**130.36 px came back in English and 95.97 px in Hebrew with the search panel alone; with the
navigation panel open as well the chrome is 83.58 px in both languages** — the strip is empty and
`semantic/12`'s `tidyStrip` takes it down.

**AND THE BASELINE HAS MOVED SINCE ROUND TWO, which the item told this lane to measure rather than
assume.** Round two reported 230.53 px English and 166.75 px Hebrew with the panel open. Today the
English figure is better (211.94) and **the Hebrew figure is worse (189.34, against 144.36 measured
by this lane this morning)**. The cause is not this lane's work and is named here so nobody reads
it as a regression of it: `semantic/12` added a place counter to the MARK and the YOU groups in the
strip as well, which is two more lines in a bar that still holds them while the navigation panel is
shut. Open that panel — which is what it is for — and the whole strip goes.

This lane's own contribution to the strip is one line, `.tvnavfoundplace`, and it too leaves the
moment the search panel opens.

---

# 9. EVERY REMOVAL PROOF, AND WHAT REDDENED

**24 mutations, each applied alone and reverted. FOUR reddened nothing on the first run and all
four are below with what was done about them** — a proof that reddens nothing is the most valuable
thing a run like this produces.

**THE HAZARD, STATED, because both previous rounds asked the next lane to state it.** Files under
`src/ui/public/` are read LIVE FROM DISK by every running UI server, the owner's own on 58888
included. Every window here was ONE filtered Playwright run — fifteen to forty seconds — and the
file is restored in a `finally`, so a crash restores it too. Restoration verified afterwards by
grepping for each mutation's own marker: zero for all of them, and the four idempotent re-apply
scripts report every hunk still standing.

```
  MUTATION                                                        reddened
  ──────────────────────────────────────────────────────────────────────────────────────
  the counts go back to the end of the panel                         2
  the sentence is put above the stepper inside the block             1   HEBREW ONLY
  the blue is not the meaning hue (a literal that looks the same)    2
  the colour goes on the whole sentence, not the number              2
  the numbers are not coloured at all                                2
  the reference is drawn for every mode                              2
  the refusal row is dropped from the reference                      2
  the quantifier section is dropped from the reference               2
  ligatures are left on, so `<=` is drawn as `≤`                     2
  one example is a pattern this engine refuses                       2
  one example is a query its own mode cannot read                    2
  the place is not redrawn by the step, only by the paint            2
  the place claims position 1 before anything was stepped to         2
  the walk is not given up when the answer is replaced               2   (see 9.1)
  the walk wraps round at the end                                    2
  a floating panel is not subtracted from the band                   2
  the band is chosen by size without asking if it can be reached     1   HEBREW ONLY  (9.1)
  the column test reads the collapsed caret, not the match           1   ENGLISH ONLY (9.1)
  Clear empties the box and never re-asks the scan                   2
  Clear leaves the caret on the button                               2
  a refused scan is never recorded as refused                        2
  the refusal sentence is never taken down again                     2
  the panel says nothing about a scan that was refused               2
  the stepper still claims a measured zero over a refused scan       2   (see 9.1)
  ──────────────────────────────────────────────────────────────────────────────────────
  24 of 24 reddened, after 9.1.
```

## 9.1 THE FOUR THAT REDDENED NOTHING, AND THIS IS THE SECTION TO READ

**1. *"the stepper still claims a measured zero over a refused scan"* reddened nothing, and THE
ASSERTION WAS THE DEFECT.** The test asserted that the stepper said SOMETHING. *"No turn here holds
what you typed"* is also something, so a build that drew a measured zero over a refused scan passed
every line. Fixed by taking a GENUINE zero first — a query that really finds nothing — and asserting
the refused case does not draw the same sentence, which is what
`nothing-to-do-and-could-not-look-are-different-answers` actually asks.

**2. *"the walk is not given up when the answer is replaced"* reddened nothing, and THE MUTATION
was wrong rather than the assertion.** It disabled `cursor.mark` and the test walks `cursor.found`.
Retargeted at the line the test rests on; it reddens two.

**3. *"the band is chosen by size without asking whether it can be reached"* reddened nothing,
because the fixture's geometry never produced an unreachable larger band.** This is the defect §5.3
records — found by hand in Hebrew, where the larger slice was below the panel and reaching it meant
scrolling up from zero. Fixed by giving the test that geometry on purpose: the window is made tall,
the panel is dragged to leave 60 px of well above it, and the walk is restarted at the first match.
It now reddens, **in Hebrew only**.

**4. *"the column test reads the collapsed caret rather than the match"* reddened nothing**, for the
mirror reason: at the drag position the test used, the match was wholly to one side of the panel, so
a point and a rectangle answered the same. Fixed by computing the drag from the page — the panel's
leading edge is put a few pixels INSIDE the match that is currently standing — rather than from a
constant. It now reddens, **in ENGLISH only**, because in Hebrew the same construction leaves the
match's start outside the panel either way.

**Read the three one-language rows together.** Two of the four silent proofs, and one of the twenty
that were never silent, redden in exactly one language — which is the whole argument for driving
both, and the same shape `semantic/9` recorded when an RTL drag delta passed in English and failed
in Hebrew on one build.

---

# 10. THREE DEFECTS FOUND BY LOOKING AT A SCREENSHOT

Round one found a find box 470 px tall; round two found a panel 220 px off the bottom and an RTL
direction bug. This round found three more, and every one of them was green in every test.

**1. A ONE-CHARACTER CONSTRUCT READ AS AN EMPTY CELL.** `.`, `^` and `$` in the left column of the
reference are one glyph of monospace ink on a dark ground, and the first picture of the table showed
three rows that looked empty beside sentences plainly describing something. `.mcpanelegq`'s chip
treatment — paper ground, hairline, small radius — makes a full stop a token rather than a speck. It
is not a button and does not pretend to be one: no hover, no cursor, no focus ring.

**2. A LONG MONOSPACE RUN WRAPPED INSIDE A HEBREW SENTENCE.** The characters that need a backslash
shipped as one `{m:…}` run inside `conv.find.refEsc`. A monospace run is `unicode-bidi:isolate`,
which orders it correctly — until it WRAPS, and then an RTL reader meets the second half above the
first. Fourteen bidi-neutral characters in the middle of a Hebrew sentence is the widest possible
version of that hazard. Moved into the reference's left column, where `white-space:nowrap` means it
cannot wrap at all and the sentence beside it has no run in it.

**3. A FONT LIGATURE DREW `(?<=ab)` AS `(?≤ab)`.** Geist Mono ligates `<=` into `≤`. **A reference
that shows a reader a character they cannot type is worse than no reference** — they would copy it,
the pattern would not compile, and the panel would quote the browser's complaint about a construct
the help had just taught them. `(?<!ab)` beside it is unligated, so the row disagreed with itself.
`font-variant-ligatures:none` on that column, and the browser suite asserts the computed value
because the text content is right either way.

**AND THE THIRD IS A WIDER FINDING THIS LANE DID NOT TAKE.** This face ligates `->`, `!=`, `>=` and
`<=` in EVERY `.m` run in the product. That is a legibility choice somebody made for the whole
shell, and it is right for a path or an id — but wherever a run is meant to be RETYPED it is the
same defect. Reported rather than repaired by a lane that owns one table.

---

# 11. WHAT MUST NOT REGRESS, AND DID NOT

  — **EVERY MODE, OPTION AND COUNT IS STILL COMPUTED IN THE SERVER SCAN**, through the one
    `findQuery` the count and the highlights share. Nothing this lane added computes an answer in
    the page: the counts are moved, coloured and counted; the reference is static text; the position
    counter reads `cursor.found`, which is an index into the server's own stop list. The four
    `semantic/11` mutations that redden when a mode is left out of the request are untouched and
    still green.
  — **BOTH LANGUAGES, EVERYWHERE.** Every measurement in this report was taken twice, the suite runs
    24 tests × 2 languages, and three of the twenty-four removal proofs redden in one language only.
  — **A BOLDED NUMERAL INSIDE AN RTL RUN** is exactly where `semantic/11` said this breaks. The blue
    goes on the SAME span that already carries the weight and `unicode-bidi: isolate` — one isolated
    directional run whose colour changed and whose boundaries did not. Checked on screen in Hebrew:
    the count line reads `41 מתוך 16461 קטעים מוצגים. 41 תורות … 57 פעמים — … 4715 … 56159 רשומות`
    with all six numerals blue, bold and in their right places.
  — **`semantic/9`'s and `semantic/11`'s panels still work.** The whole 48-test file is green in
    both engines, and so are the five neighbours that name `.tvfind`, `.tvnav` or a value slot.

---

# 12. WORKING BESIDE ANOTHER LANE IN ONE FILE, AND WHAT IT COST

`semantic/12` and `semantic/13` were writing `screens/conversations.js` throughout this lane. **Nine
of this lane's hunks were silently overwritten at least once**, and one of them — the `foundPlace`
element, with `drawFoundPlace` left behind referring to it — took the document screen down
completely with `foundPlace is not defined`. **That was found in a screenshot**, which is the fourth
time on this panel that a picture caught what nothing else did.

What was done about it, recorded because the next lane in this situation will want it:

  — Every hunk was rewritten as an **idempotent re-apply script** keyed on its own marker, so a
    clobber costs one command rather than a re-derivation. Four of them, thirteen hunks.
  — Any hunk `semantic/12` had **adopted** was retired from those scripts by name rather than
    re-applied, so re-running can never resurrect a second implementation of something they now own.
  — A whole-spec run was treated as evidence only after a re-apply pass reported every hunk
    standing. One run of 48 tests was wasted before that rule existed: ten tests failed because two
    hunks had been overwritten mid-run.

**This is not a complaint about the other lane** — they landed the shared `drawPlace` the owner
asked for, and adopting it was the right call in both directions. It is a measurement of what two
lanes in one 11,000-line file costs, and the answer is roughly one wasted three-minute run per
clobber plus the time to notice.

---

# 13. FILES TOUCHED

**Changed:**

  — `src/ui/public/screens/conversations.js` — the counts block and its wrapper; the Clear button
    and the field row; the regular-expression reference (`REGEX_REF`, `buildReference`, and the one
    line in `drawHelp` that decides whether it is drawn); five new examples; `findFailed` and its
    three sentences; `foundPlace`; `showMatch`'s banding, the match's real width and
    `MATCH_BAND_MIN_PX`.
  — `src/ui/public/styles.css` — `.mcpanelcounts`, the `--carry` rule for the find counts,
    `.mcpanelfindrow`, `.mcpanelclear`, `.tvnavfoundplace`, `.mcpanelref` and its table.
  — `src/ui/public/strings/en.js`, `src/ui/public/strings/he.js` — 47 new keys
    (`conv.find.ref*` ×36, `conv.find.eg*` ×7, `conv.find.scanFailed`, `conv.nav.foundsUnknown`,
    `conv.nav.noFoundsFailed`, `conv.nav.place`, `conv.nav.placeIdle`); `conv.nav.atFound` and
    `conv.find.refEsc` reworded.
  — `e2e/conversations-find-panel.spec.ts` — 9 new tests × 2 languages, and the `@basis` line.

**New:**

  — `reports/2026-09-17-the-find-panel-counts-and-reference.md` — this file.
  — `reports/2026-09-17-the-find-panel-counts-and-reference.png` — the panel on the live session,
    English, pattern mode, the reference open.
  — `reports/2026-09-17-the-find-panel-counts-and-reference-he.png` — the same in Hebrew.

---

# 14. GATES

```
  playwright chromium   48 passed — this lane's spec, 24 tests × 2 languages
  playwright chrome     48 passed — the same, in Google Chrome itself (owner ruling 2026-08-22).
                        One run of this project reported 47/1: `semantic/11`'s operator test in
                        Hebrew, which passes 2/2 when the file is run again or that test alone.
                        A flake under parallel load, not this lane's and not a build state —
                        recorded rather than re-run until it was quiet.
  playwright chromium   91 passed — conversations-find, doc-actions, doc-navigation, bidi,
                                    docs-bidi: every neighbour that names `.tvfind`, `.tvnav`
                                    or a value slot
  node --test           327 passed — strings-parity, viewmodel, styles-parity, pane-float, i18n
  npx tsc --noEmit      clean
  check:basis           no test file outside the baseline is missing a basis or malformed
  check:text-files      1450 text file(s), none holds a NUL byte
  check:test-glob       the glob reaches all 591 test file(s)
  check:dependencies    package.json declares no runtime dependency
  check:vendor          28 vendored file(s) match VENDOR.md
  check:retired         104 retired phrase(s), 0 still present in a body
  git status src/rules/entries/   EMPTY — the shipped rule store is unharmed
```

**`npm test` was NOT run**, and that is the item's own instruction: a known defect means a whole-
suite run can leave the shipped rule store dirty, and every gate above was reached by a targeted
run. `git status src/rules/entries/` printed nothing.

**ONE FAILURE THAT IS NOT THIS LANE'S AND IS THE SAME ONE ROUND TWO RECORDED.**
`e2e/screen-parity.spec.ts` fails as a LOAD failure rather than a ledger failure on this machine —
its own message: *"preview: still growing, still holding the router's unread chip, or still fetching
(4 `/api` reads in flight), after 25 samples over 10s — it was NOT compared … This is a LOAD
failure"*. Round two reported it in the same words on 2026-09-16.

---

# 15. WHAT IS THE OWNER'S TO DECIDE

1. **The blue is scoped to the find counts, not to every numeral in the product.** §2.3. Widening it
   is one line and would be the more consistent reading of what `--carry` means; it also changes
   every screen and needs the contrast measured on every ground those numerals sit on.

2. **The match walk steps TURNS, not occurrences.** §6.3. A turn holding four hits is one stop and
   the other three cannot be reached. The counter says `turns` rather than implying otherwise. A
   walk over occurrences needs per-match offsets the scan does not return today — a real feature,
   and his to ask for.

3. **Wrap-around is still refused, and the counter is the reason it should stay refused.** §6.2. If
   he wants it anyway it is two lines and the mutation that adds it is already written.

4. **The ligature hazard is wider than the reference.** §10. Every `.m` run in the product ligates
   `->`, `!=`, `>=` and `<=`. It is correct for a path and wrong for anything meant to be retyped.

5. **A page newer than the server it is talking to is a state this product creates for itself.**
   §4.2. It has now cost two diagnoses in two days. The panel says so when a find request is
   refused; nothing says so when the mismatch is subtler.

---

# 16. WHAT WOULD MAKE THESE NUMBERS WRONG

  — **A different session.** Every example's hit count is 4,656 prose spans of one transcript, and
    that transcript grew by about 40 spans while this lane ran. What is asserted about an example is
    that it finds SOMETHING, and the report carries what it found today.
  — **A different window.** Every strip height and every landing is 1280 px wide. The counts wrap
    differently elsewhere, which is why the suite asserts the SHRINK and the SAMENESS rather than
    the numbers.
  — **A different panel position.** §5.4's landings are two positions out of an infinity: the panel
    is draggable and remembered. What is measured is that a panel covering the match is subtracted
    from the band and that the band chosen is one the scroll can reach — both of which hold at any
    position, and neither of which can save a match under a panel taller than the well.
  — **A different face.** The ligature finding is Geist Mono's. A build with a different monospace
    would ligate a different set, or none.
  — **A Hebrew corpus.** The Hebrew rows are 13 turns and 82 runs of Hebrew on an archive whose
    Hebrew is a handful of prompts plus this project's own UI strings. The MECHANISM is what is
    measured there; the traffic is not.
