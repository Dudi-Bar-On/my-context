# THE OTHER TWO PANELS — navigation and copy, and one stepping standard

`semantic/12` — `TASK-the-navigation-controls-still-crowd-the-strip-and-they-are`
`semantic/13` — `TASK-the-copy-controls-are-four-buttons-and-a-sentence-and-they`

Lane AS, 2026-09-17. Driven against this repository's own live session
`595db3b1-a481-4553-b4c0-7248c31b2655` on a throwaway server on **port 58941**, `--no-open`, killed
at the end. **Port 58888 was never touched.**

---

## THE ANSWER IN FIVE PARAGRAPHS

**The three panels the owner specified on 2026-09-16 now exist.** Search shipped as the template;
navigation and copy were promised in the same breath, never written down, and would have been lost
if he had not asked. Both are callers of `lib/panel.js` rather than boxes of their own: between them
they added **no dialog mechanics at all** — no `show()`, no Escape, no drag, no store, no clamp, no
focus hand-back. **The frame needed ZERO lines of change to carry a second and a third caller.**
That is the finding the item asked for, either way, and it is the good one.

**The strip is gone.** Measured on the live session at 1280×1000 with a query in the box, Hebrew:
the chrome between the top of the bar and the top of the viewer was **240.13 px** before this lane
and **201.14 px** with the search panel open, which is where `semantic/11` left it. With all three
panels open it is **56.98 px** — two buttons and one instruction line. `.tvnav` has no children at
all and is taken down.

**The disclosure is LENT, not moved, and that is the answer to the question the item raised.** *"612
more are in this conversation and the search is hiding them"* is `INV-nothing-is-dropped-silently`
spent on a screen, and a count nobody can see is a count that was dropped. `markCount` and
`youCount` are the SAME two elements in both places: in the panel while it is open, back in the
strip the moment it shuts. There is no state of this screen in which the disclosure is nowhere. One
word of it was already false and is fixed — it said *"the search ABOVE"*, and the find box has not
been above anything since `semantic/9`.

**The owner's addition landed mid-lane and it made this a design rather than a move:** *"because you
are still 3 dialogs, apply the same behaviour of highliting the current for Marks and Messages as
navigation standard behaviour"*. **`semantic/14` landed the matches half first**, so this lane
ADOPTED what was there rather than writing a second one: `drawPlace`, `paintStanding` and
`revealBox` are each one function with three callers, and `semantic/14`'s own match walk now calls
two of them rather than owning them.

**Seven defects, five found by looking or reading.** The borrow recipe `semantic/9` shipped cannot
survive two panels lending out of one strip and would have thrown inside `onClose` on the copy
panel's FIRST close, every time. Three panels opened for the first time landed exactly on top of
each other. The line that points AT the copy panel was drawn inside it. `p.tvcopied` was an
instruction until the first copy and a report afterwards. A mark stepped to landed underneath a
panel. A position outlived the walk it described. And a gate caught an object shorthand the
string-slot parser cannot see — in `semantic/14`'s sentence as well as in the two this lane added.

---

# 1. THE STRIP, BEFORE AND AFTER

The item states the acceptance test in its own words: *"report the strip's height before and after;
if it does not shrink, the change has not landed."*

## 1.1 On the live session, 1280×1000, by hand in Chromium, query `byte offset`

`chrome above well` is `.tvscroll`'s top minus `.tvbar`'s top: every pixel of control between the
reader and the document he came to read.

**BEFORE this lane** — taken before a line was written, both languages:

```
                            no panel     with the search panel
  en  .tvbar                   62.58                     26.39
  en  .tvnav                  162.75                    128.36
  en  chrome above well       372.69                    264.92

  he  .tvbar                   28.19                     26.39
  he  .tvnav                  117.56                     83.17
  he  chrome above well       240.13                    201.14
```

**AFTER** — the same session, the same width, the same query, with `semantic/14`'s counter and this
lane's stepping standard both in:

```
                            no panel     search only     all three panels
  he  .tvbar                   28.19           26.39                26.39
  he  .tvnav                  162.75          105.77                 0.00  (taken down)
  he  chrome above well       285.31          189.34                56.98
```

**183.16 px came back against the state `semantic/11` left standing — 72 % of it.** Against the
no-panel state, 228.33 px, 80 %.

**The BEFORE numbers differ from the item's stated 230.53 / 166.75, and that is measurement rather
than disagreement.** Those were `semantic/11`'s figures on 2026-09-16. This session has grown since
(137 MB and 483 lanes today), the count line has gained a clause, and `semantic/14` added a position
counter to the match group while this lane was running — so the same screen is taller today than it
was yesterday, before anything shrank it. Every number in one table above was taken on one build,
minutes apart. **What the suite asserts is the SHRINK and the emptiness of `.tvnav`, never a single
figure**, for exactly this reason.

## 1.2 In the browser suite, both languages, 1280×720

`e2e/conversations-panels.spec.ts` takes the same three boxes and fails if the chrome does not
shrink past the state the search panel leaves:

```
  en   before {bar 62.59, nav 60.80, chrome 217.77}
       search {bar 26.40, nav 60.80, chrome 144.38}
       all    {bar 26.40, nav  0.00, chrome  56.99}

  he   before {bar 28.20, nav 60.80, chrome 183.37}
       search {bar 26.40, nav 60.80, chrome 144.38}
       all    {bar 26.40, nav  0.00, chrome  56.99}
```

## 1.3 And one line shrank before any panel opened

`conv.copy.hint` lost the explanation it used to carry. That sentence did not disappear — it is in
the copy panel now, four sentences, one under each control it is about (§3). What is left in the
strip is a pointer, and a pointer is one line shorter than an explanation.

---

# 2. THE NAVIGATION PANEL, AND THE DISCLOSURE QUESTION

## 2.1 What moved

`navHead` (*"Step to"*), the kind `<select>` with its `K` chip, Previous/Next mark, Previous/Next of
your own messages, both counts, both new position slots, and `navSaid` — the `aria-live` region a
step announces into.

`navSaid` is there deliberately rather than for tidiness. A reader stepping from inside the panel
would otherwise have *"Marked point 3 of 636: …"* drawn on the strip BEHIND the panel he is standing
in. It is `hidden` until a step happens, so it costs the strip nothing either way.

## 2.2 The disclosure, answered deliberately

The item is right that this is real, and it names the stake: **a count nobody can see is a count that
was dropped.**

**The answer is that the count is LENT and not MOVED, and those are different things.** The borrowing
shape `semantic/9` chose for search — the control is the same element in both places — is what makes
the answer available at all. `markCount` and `youCount` are in the panel while it is open, beside the
walk they qualify, where a reader who opened the navigation panel is actually looking. The moment it
closes they are back in the strip, drawn exactly as they are today, by the same `onClose` that
returns the buttons. **There is no state of this screen in which the disclosure is nowhere.**

Three alternatives were considered and refused:

- **A second copy of the count in the strip**, drawn only when something is hidden. Refused: two
  elements carrying one sentence is the exact defect this repository spent 2026-09-07 measuring, and
  the day they disagreed nothing on the screen would say which was right — the same argument
  `semantic/9` used to refuse a second find box.
- **Leaving the counts in the strip and moving only the buttons.** Refused: the counts ARE the
  residue `reports/2026-09-16-the-find-panel.md` §2.3 measured (661 px and 681 px wide against a
  1019 px bar), so leaving them is leaving the item undone.
- **A short "N hidden" line that stays behind.** Refused for the same reason as the first, and
  because it re-grows the strip in exactly the state the item cares about — with a query typed,
  which is when things are hidden.

Test 3 drives it: the sentence is read in the strip, read again inside the panel, read a third time
in the strip after closing, and all three must be the same string.

## 2.3 And one word of it was false

`conv.nav.marksHidden` and `conv.nav.yousHidden` said *"the search **above** is hiding them"*.
`conv.nav.noFounds` said *"Type in the find box **above** first"*, and `conv.menu.noRow` said *"The
search **above** is hiding all of them"*.

**The find box has not been above anything since `semantic/9` shipped.** It is in a panel the reader
drags wherever he likes — including below the fold, which round two had to fix. The word was already
wrong yesterday and would have become wrong twice today. It is removed in both languages; nothing
else in the four sentences changed.

## 2.4 What did not move, which is the half that matters

`runShortcut` has always called `step('mark', …)`, `step('you', …)` and `cycleKind(…)` DIRECTLY
rather than through the buttons, so `N`, `Shift+N`, `U`, `Shift+U`, `K` and `Shift+K` act identically
with every panel shut, open, or dragged off the bottom of the screen. The `aria-keyshortcuts` and the
drawn chips travel on the controls themselves. Driven both ways in test 10 and by hand (§6).

---

# 3. THE COPY PANEL

## 3.1 The sentence is the subject, not the buttons

The item's own words. `conv.copy.hint` carried the whole explanation as one run of grey prose in a
strip a reader skims — *"The first is the one to reach for: it is the text as the record holds it,
with no page formatting in it, and a command comes out as the command"* — describing three controls
by their ORDER. In the panel each control carries its own sentence, underneath itself:

```
  to paste into a prompt   The text as the record holds it, with no page formatting in it,
                           and a command comes out as the command. This is the one to reach for.
  to paste as it looks     The browser's own text for what is on the screen. It can carry
                           direction marks you cannot see and spacing the page collapsed.
  the exact record         The bytes of the transcript file itself, between the two offsets your
                           passage spans. Nothing is re-rendered, and a record is taken whole or
                           not at all.
  ── And one that is not a copy —
  Reconstruct a subject    It puts nothing on the clipboard and sends nothing. It fills the
                           reconstruct panel at the foot of this document with what you marked,
                           and takes you to it.
```

The strip's own line is rewritten to POINT at the panel rather than repeat it. A second copy of a
sentence cannot be superseded; only the original can.

## 3.2 Why three of them are grey, said where there is room to say it

The item: *"three of the four are disabled until something is selected, which is honest and
invisible: a reader who has selected nothing sees four greyed controls and no reason. A panel has
room to say why."*

`conv.copy.need` is drawn exactly while it is true — the state is read off `copyMessage.disabled`
rather than kept beside it, so a second copy of "is anything marked" cannot disagree with the buttons
it describes. Marking a passage arms the three and takes the line down in the same turn.

## 3.3 `Reconstruct a subject` — the decision the item asked for

**It stays in this panel, under a heading that says it is not a copy.**

The item is right that it is not one: it puts nothing on the clipboard, it fills the retrieval card at
the foot of the document and scrolls to it. But it is reached at the same instant and by the same
gesture as the other three — a passage marked in the well — and it reads the same `clip` payload they
write. Moved elsewhere it would need a second route to a selection that already has one, and
`REQ-every-anchor-capability-is-reachable-from-the-screen-and-a` is the rule about capabilities that
lose their way in. So: same panel, its own heading (`conv.copy.notCopy`), and a sentence that says
plainly what it does instead of copying.

## 3.4 THE CONSTRAINT A READER MUST KNOW, AND IT IS REAL

**The copy panel cannot be opened while a passage is marked.** The `contextmenu` handler yields to
the browser's own menu over a live selection, deliberately and for a recorded reason: *"the three
copy controls in the bar exist precisely for a marked passage, so a reader who has just dragged
across a turn and right-clicked means Copy."* That rule is correct and is not touched. It means the
order is **open the panel, then mark** — which is exactly the shape the owner asked for (*"stays on
screen while you can look at the viewer"*), and it is driven that way in test 7.

For the reader who marked first, the four buttons are still in the strip, because the panel only
borrows them while it is open. Nothing was taken away from the gesture that already worked.

---

# 4. ONE STEPPING STANDARD, THREE WALKS — the owner's addition

*"because you are still 3 dialogs, apply the same behaviour of highliting the current for Marks and
Messages as navigation standard behaviour"*, 2026-09-17.

## 4.1 WHO LANDED FIRST, WHICH THE BRIEF ASKS TO BE SAID

**`semantic/14` landed the matches half first**, hours before this. So this lane ADOPTED what was
there rather than writing a second one — that lane's `conv.nav.place`, its `.tvnavcount` place slot,
its `drawFoundPlace` and its panel-aware `showMatch` are the shapes the other two walks now use.
Two of those became shared functions in the process, and `semantic/14`'s own caller now calls them
rather than owning them.

**`step(which, forward)` was already one implementation with three callers** — that half was never
the problem. What had grown three different amounts of feedback was everything AROUND it, and that
is what he noticed. Three things were factored:

| the behaviour | one function | its three callers |
|---|---|---|
| where the walk is up to | `drawPlace(which, howMany)` | mark, you, found |
| which one you are standing on | `paintStanding()` + `standingAt` | all three, one variable |
| landing somewhere you can see | `revealBox(box, span)` | `landOn` (mark, you) and `showMatch` (found) |

`revealBox` is `semantic/14`'s reasoning lifted OUT of `showMatch` unchanged rather than copied.
`landOn` scrolled a row to the TOP of the well and knew nothing about the panels floating over it —
which is exactly where a panel opened under the bar sits.

## 4.2 THE TWO QUESTIONS THE BRIEF SAID TO DECIDE RATHER THAN DISCOVER

**What `Next` does at the end: THE REFUSAL OF WRAP-AROUND STILL HOLDS, and the counter strengthens
it rather than weakening it.** Round one refused wrapping on the record — *"the walk already names
the end"* — and a counter does not change that: at `15 of 15`, pressing Next says *"Nothing is marked
after this point… it is still where you are"* and the counter still reads `15 of 15`, so the reader
is told the same fact twice, in words and in a number. **Wrapping would make the counter jump 15 → 1
with no gesture saying why**, and a reader who pressed Next once too often would be at the top of a
636-mark document unable to tell that from a mis-press. The end is a fact; the counter is the thing
that makes it visible.

**What the counter reads before the first step: THE BUTTON'S NAME, not a number.** `0 of 15` is a
lie — there is no zeroth mark — and `1 of 15` claims a position the reader has not taken, after which
the first press of Next would move them to `2 of 15` having skipped one. So the idle state reads
*"Press Next mark to walk them."* / *"Press Your next message to walk them."*, which is the shape
`semantic/14` had already chosen for matches and is adopted rather than re-argued.

## 4.3 What it looks like, measured on the live session

```
  idle      Press Next mark to walk them.
  N         You are on 1 of the 636 marked points here.     .tvrownow on row 30
  N         You are on 2 of the 636 marked points here.     .tvrownow moved
  N         You are on 3 of the 636 marked points here.
  Shift+N   You are on 2 of the 636 marked points here.     it counts back DOWN
  U         You are on 4 of the 600 messages of yours here. the mark place is untouched
  wheel     Press Next mark to walk them.                   the walk is thrown away, and so is
                                                            everything that described it
```

**The count and the place are two elements and not one longer sentence**, and that is a decision:
`markCount` says how many there are and what a filter is hiding, and changes when the DOCUMENT or
the query changes; the place says which one the reader is standing on, and changes when the READER
presses a button. One sentence carrying both would be redrawn for either reason, and the half a
reader is watching would flicker for changes that are not about them.

**The emphasis is not colour alone.** `.tvrownow` is an OUTLINE — not a border, because every row
here is absolutely positioned from a measured model and two more pixels of height would move every
row below it — in `var(--ink)`, which spends **no sixth hue**: the five meaning colours stay
`--gold`, `--ok`, `--carry`, `--crit`, `--warn`, and the current MATCH is already the page inverted,
so the current TURN is the page's own ink drawn as a frame. The second carrier is
`aria-current="location"`, on the same element.

## 4.4 The limit, stated rather than left to be found

**At the very top of a document, a target a panel covers cannot be pushed out from under it.**
Reaching the free band would mean a negative `scrollTop`. `revealBox` already says so in its own
words and falls back to the old landing, which is no worse than before any of this existed. The test
asserts the claim that is actually true: once the walk is away from the top, where the scroll CAN
reach a free band, it does. Written as a single press first, and it reddened — correctly.

---

# 5. THE FRAME NEEDED NO CHANGE — AND THE BORROW NEEDED ONE

## 5.1 `lib/panel.js` is untouched

Zero lines. The two new callers supply `name`, `title`, `closeLabel`, `onClose`, `fallbackFocus` and
a first-open place, and get `show()`-not-`showModal()`, the hand-wired Escape with its
`stopPropagation` guard, the drag with pointer capture and its one-write-per-gesture store, the
logical-property placement with its single RTL reflection, the clamp, the height bound rewritten on
every placement, bring-to-front, the named close button and the focus hand-back. **A frame built with
one caller carried a second and a third without an edit.**

The one thing that was NOT in the frame and had to be written per caller is the borrowing, exactly as
`reports/2026-09-16-the-find-panel.md` §3 predicted — and that is where the defect was.

## 5.2 DEFECT, found by reading: the borrow recipe cannot survive two panels

`semantic/9` recorded each borrowed control as the pair `(parent, nextSibling)`, for a stated and
correct reason. **It is not safe once two panels lend out of one strip, and both new panels hit it.**

- `copyLabel`'s recorded next sibling is `copyMessage`, which the SAME panel lends. Restoring in list
  order runs `bar.insertBefore(copyLabel, copyMessage)` while `copyMessage` is still inside the
  dialog: **`NotFoundError`, thrown inside `onClose`** — the one path the close button, Escape and
  every other route out all share. The panel would close with its controls stranded in a closed
  dialog and the strip missing five children, on the first close, every time.
- `youGroup`'s recorded next sibling is `foundGroup`, which the **SEARCH** panel lends. That one
  fires only when both panels are open at once — a thing the frame allows by design and the owner
  asked for by name — and it is the worse of the two, because it is intermittent.

Reversing the loop fixes the first and not the second: `foundGroup` is not the navigation panel's to
restore, so no ordering of its own list can put it back before `youGroup` needs it.

**The fix is to keep the place with a MARK IN THE DOM rather than with a name for a neighbour.** A
comment node is left standing exactly where the control was, and the control is put back by replacing
its own mark. It cannot be wrong about a sibling because it does not name one; it survives siblings
arriving, leaving and being lent to somebody else; and a comment is invisible to layout, to
`childElementCount`, to `querySelectorAll('*')` and to every gate in this suite that walks elements.
One helper, `borrow(nodes)`, now serves all three panels, and the search panel's own restore path was
rewritten onto it.

Test 5 is that case and nothing else in the suite reaches it.

## 5.3 DEFECT, found by looking: three panels opened on top of each other

`semantic/9` shipped one caller and one constant, `start: 24`. With three callers and one constant, a
reader who opens all three on a fresh browser gets three panels at exactly the same point — the top
two completely hidden behind the third, with nothing on the screen saying they are open and no header
left to drag them apart. **Every assertion stayed green, because "the panel is open" is true of all
three.** Caught in the first screenshot of all three open.

`panelPlace(at)` is a cascade of 32 px — a window manager's answer, and the smallest one. Measured on
the live session, English: 24/284, 56/316, 88/348. Hebrew, where the start edge is the RIGHT one:
right edges at 1256, 1224, 1192.

## 5.4 DEFECT, found by looking: the panel told the reader to open itself

`conv.copy.hint` used to be the initial CONTENT of `p.tvcopied`, the `aria-live` region that reports
what a copy TOOK. One element was therefore an instruction until the first copy and a report
afterwards. The copy panel must borrow the report — a copy made inside the panel has to say what it
took inside the panel — and borrowing the report borrowed the instruction, so the panel drew
*"Right-click any turn for the copy panel"* INSIDE the copy panel. Two things, two elements now.

## 5.5 DEFECT, found by driving it: a position outlived the walk it described

`endWalk` throws the walk away on any wheel, key or pointer in the well, and it already cleared the
cursors and the current-item emphasis. **The POSITION went on standing**: scrolled away by hand, the
strip still read *"You are on 2 of the 636 marked points here"* about a place the reader had left —
a second thing on the screen contradicting the stepper, which is the rule `foundNow` already followed
one control along. `clearPlaces()` closes it, and re-derives nothing: the totals cannot have changed
since the last `navRefresh`, because nothing a wheel does adds a mark.

## 5.6 DEFECT, found by a gate: an object shorthand the slot parser cannot see

`ctx.t('conv.nav.place', { n: at + 1, total })` — `test/ui/viewmodel.test.ts` reads every key and
every SLOT out of this file by PARSING it, and it cannot see a shorthand. It reported *"conv.nav.place
needs {total}, and conversations.js does not pass it"* for all three sentences, **`semantic/14`'s
included**. The parameter is named `howMany` now, which makes the shorthand unwritable.

## 5.7 DEFECT, found by a gate: `dialog.mcpanel` stopped naming one element

Six tests in `e2e/conversations-find-panel.spec.ts` went strict-mode red the moment the navigation
panel mounted. That is the `data-panel` handle `createPanel` has always written earning its place,
not a cost of the new panels: every locator that EVALUATES one element now says which panel it means,
and the ones that COUNT open panels are left alone.

---

# 6. THE PLAYWRIGHT EVIDENCE, IN BOTH LANGUAGES

## 6.1 Driven by hand, against this repository's live archive

Own server on **port 58941**, `--no-open`, killed at the end. **Port 58888 never touched.**

**English.** Right-click a turn → three new rows at the foot of the menu. All three open non-modal,
cascaded, with the viewer still scrolling behind them. The strip falls and `.tvnav` is `hidden` with
`childElementCount === 0`.

*Navigation panel.* Dragged from (56, 352) to (356, 232) by a real pointer — the panel followed by
exactly (+300, −120) and `localStorage['mycontext.panel.navigate']` read `{"start":356,"top":232}`.
Closed on its `×`: `navHead`, both groups and `navSaid` back in `.tvnav` in their original order,
caret on `Next mark` rather than on `BODY`. Reopened from the menu at exactly (356, 232). Escape with
the panel focused: closed, controls home, caret on `Next mark`.

*Copy panel.* Opened with the caret on the close button, the three controls disabled, and
`conv.copy.need` up saying why. Marking a passage in the well **with the panel open** armed all three
within one turn, took the reason line down, and left the selection alive. `to paste into a prompt`
from inside the panel wrote 1 section to `pre.tvclip` and reported *"Copied 1 section — record
2494."* inside the panel.

*The stepping standard.* `N` → `1 of 636`, `N` → `2`, `N` → `3`, `Shift+N` → `2`, and `.tvrownow`
with `aria-current="location"` moving with every press, exactly one at a time. `U` → `4 of 600`
without touching the mark place. A wheel took both places and the emphasis down together. Scrolled
60,000 px away (the row evicted, `.tvrownow` gone) and back — the emphasis returned on the same row,
which is what `paintStanding()` at the end of `rebuild()` is for.

*The cross-panel restore.* Search opened, navigation opened, navigation closed while search still
held `foundGroup` and `p.tvcount`: no error, and `.tvbar`, `.tvnav` and `.tvroot` all came back to
their original child order.

**Hebrew.** `dir="rtl"`. The menu rows read *"לחפש בשיחה הזאת"*, *"מעבר בתוך השיחה הזאת"*, *"העתקת מה
שסימנתם"*; the close buttons *"לסגור את חלונית המעבר"* and *"לסגור את חלונית ההעתקה"*.

**And the RTL placement is where a logical coordinate earns its keep.** The cascade opened the three
panels with their RIGHT edges at 1256, 1224 and 1192 — `1280 − 24`, `1280 − 56`, `1280 − 88` — the
same logical places as English, the opposite physical ones. Dragging the copy panel 200 px physically
LEFT moved it 200 px left (744 → 544) and moved the stored logical start 200 px UP (88 → 288).
Closing and reopening put it back at exactly the same pixels.

## 6.2 Driven by the suite

`e2e/conversations-panels.spec.ts`, 10 tests × 2 languages:

```
  chromium   20 passed (1.1m)
  chrome     20 passed (1.1m)
```

Both projects, because the owner ruled on 2026-08-22 that it *"also must occur correct on the chrome
browser"*.

What each holds, and every one is a fact a unit test cannot see: that neither panel is `:modal` and
the viewer really scrolls with both open; that the chrome shrinks past the state the search panel
leaves, that `.tvnav` is empty and taken down, and that each control is IN the panel it belongs to
rather than merely gone, including the two that are lent and deliberately NOT drawn; that the
disclosure reads the same in the strip, in the panel and in the strip again; that a real pointer drag
moves the panel by its own delta in both reading directions, that the close button puts everything
back, that the caret does not land on `BODY`, and that reopening lands where it was left; **that
closing one panel while another holds part of the same strip puts every child back in its original
order**; that three first-opens land at three different points; that the copy panel says why its
controls are grey, arms them when a passage is marked with the panel open, and reports what it took
inside itself; **that every walk counts where you are, moves the count under your finger, counts back
down, keeps its own place, and takes the position down when you scroll away**; **that the turn a walk
lands on is marked out, is announced as the current one, survives being evicted and rebuilt, and is
not left under a panel**; and that `N`, `U` and `K` act with every panel shut and with the panel open.

**Regression runs, chromium.** `conversations-panels` + `conversations-find-panel` together: 67
passed, 1 failed — and that one passed alone, on a machine running three lanes, which is the
contention this suite's own config has a paragraph about. `conversations.spec`, `mark-hues`,
`mark-kinds`, `doc-actions` and `doc-navigation`: green, with two more failures that each passed
alone for the same reason. Unit: **458 passed** across `strings-parity`, `viewmodel`,
`screen-literals`, `styles-parity`, `cssom-restatement`, `panel`, `passage-copy`, `pane-float` and
`disclosure` — run with the suite preload, never a bare `node --test`.

---

# 7. EVERY REMOVAL PROOF, AND WHAT REDDENED

**22 mutations, each applied alone and reverted, against `e2e/conversations-panels.spec.ts`.**

## 7.1 The two panels — 14 mutations, every one RED

```
  M1   borrow.give() restores by (parent,nextSibling) — semantic/9's own shape
       RED  closing one panel while another still holds part of the strip …
            the count that says what the search is hiding …
            the navigation panel drags, closes … and reopens where it was left
            the strip gives all its room back …                      (4 of 8 red)
  M2   tidyStrip never takes the empty stepper strip down          RED  the strip gives all its room
  M3   the navigation panel does not borrow navSaid                RED  the strip…; every key still acts
  M4   the copy panel does not borrow p.tvcopied                   RED  the strip…; the copy panel explains
  M5   the reason the controls are grey is never drawn             RED  the copy panel explains
  M6   the reason the controls are grey is never taken down        RED  the copy panel explains
  M7   the cascade is removed — all three open at one point        RED  three panels…; closing one panel
  M8   the navigation panel does not borrow the mark stepper       RED  the strip gives all its room
  M9   the caption stays in the strip when its controls leave      RED  the strip gives all its room
  M10  the pointer line is drawn inside the panel it points at     RED  the strip gives all its room
  M11  the first copy control loses its own sentence               RED  the copy panel explains
  M12  the fourth control is not marked out as not a copy          RED  the copy panel explains
  M13  the copy panel is not offered on the right-click menu       RED  5 of 8
  M14  the navigation panel is not offered on the menu             RED  8 of 8
```

**M9 and M10 were predicted to prove nothing, and the assertions were written BEFORE they were run.**
Nothing in the suite named the two nodes that are lent and deliberately not drawn, so a build that
left the caption standing over nothing, or drew the panel's own pointer inside it, would have passed.
Both assertions were added to test 2 and both mutations now redden at them.

## 7.2 The stepping standard — 8 mutations, every one RED

```
  M16  the place is drawn for the match walk only, as before this item
       RED  "the first step is not the first mark"
  M17  a step does not redraw the place, so the counter is one press behind          RED
  M18  scrolling away by hand leaves the position standing                           RED
  M19  before the first step the place claims a position rather than naming a button RED
  M20  the turn the walk is standing on gets no emphasis                             RED
  M21  the emphasis is colour alone — nothing announces which one it is              RED
  M22  a mark lands where landOn puts it, with no regard for a floating panel        RED
  M23  the emphasis is not repainted after a rebuild                                 RED (see below)
```

## 7.3 THE PROOF THAT REDDENED NOTHING, TWICE, AND WHAT WAS DONE

**M23 was green on its first run, and the green was the finding.** Removing `paintStanding()` from
the end of `rebuild()` reddened nothing, which meant the guard was either dead code or untested.

**It is not dead.** Driven by hand on the live session: step to a mark, scroll 60,000 px away
programmatically (the row is REMOVED — `.tvrownow` count 0), scroll back, and the emphasis is on the
same row again. A row that leaves the window is a new element coming back, with none of the old one's
attributes, and the only thing that re-applies them is that call. The scroll has to be programmatic:
a wheel, a key or a pointer is the reader's own gesture and `endWalk` correctly throws the walk away.
The eviction assertion was added to test 9.

**And then M23 was green a SECOND time, for a different reason: the mutant was a no-op.** It appended
a comment marker after `paintFinds();` and left `paintStanding();` on the next line untouched. A
mutation that changes nothing proves nothing, and it looks exactly like a mutation that proves the
code is dead. Rewritten to remove the call, it reddens.

**Both greens are recorded rather than quietly fixed**, because the first was a real hole in the test
and the second was a real hole in the method.

## 7.4 THE HAZARD, AND A REAL INCIDENT — read this before mutating a shared file

**`semantic/14` was editing `src/ui/public/screens/conversations.js` throughout this lane.**

**The first mutation harness written here restored a WHOLE-FILE SNAPSHOT after every mutation.** That
is a gun pointed at the other lane: any edit landing while a mutant was in place would have been
erased by the next revert. It ran for roughly twenty minutes before this was noticed. **The other
lane's work was checked and is intact** — every marker of theirs is present, and the conflict
surfaced instead as a revert that could not find its own mutant, because they had rewritten the file
(with CRLF) underneath it. That is luck, not design, and it is recorded as an incident rather than
left out.

Four rules came out of it and are written into the scripts:

1. **Surgical, never a snapshot.** Read the file fresh, replace ONE substring, put that one substring
   back.
2. **Line-ending adaptive.** The other lane writes CRLF and this one LF; a revert that assumes the
   wrong one silently fails to find its own mutant and leaves it in the tree. That happened once.
3. **Mutants must be DISJOINT from their originals.** The first set merely appended, so after a
   failed revert the apply-side assertion was still satisfied by the prefix and a second mutant was
   inserted on top of the first. Two copies of one mutation, found and removed by hand.
4. **Verify the revert and abort loudly.** Three mutants were left in the tree across this lane, each
   found and removed by hand within one step; the last runs verify in the same command.

A sandbox copy of the repository was built to avoid all of this and abandoned: the harness starts the
CLI from the repo's own `src/`, and the document would not load there.

---

# 8. WHAT IS LEFT ON THE CARD, AND WHETHER IT CAN BE STATIC

Measured on the live session at 1280×1000, Hebrew, with all three panels open. Every block still
drawn above the viewer, in order:

```
  DIV.tvhead                   28.6 px   Back to all sessions · title · size · lanes — ONE line
  DETAILS.help convsecrets     24.8 px   "Things that look private in this session" — a CLOSED fold
  DIV.tvbar                    26.4 px   Top · End — the only two controls left
  DIV.tvnav                     0.0 px   hidden
  P.tvmenuhint                 18.6 px   "Right-click any turn below for what you can do to it…"
  DIV.tvscroll                700.0 px   ← the viewer
```

Card top to bar top: **61.39 px**. Bar top to well top: **56.98 px**. The well is **700 px of a
1000 px viewport**.

**Is it already static? YES, and that is worth him knowing: nothing above the well scrolls.** The
only scroller on this screen is `.tvscroll` itself. What still moves is the PAGE, because the card
runs a little past the bottom of the viewport.

**What could go, if he wants it (his call, and this lane did not do it):**

- **`Top` and `End` are navigation.** They are the last two controls in the strip and they belong in
  the navigation panel by the same argument as the steppers. That is `.tvbar` gone — 26.4 px — and
  with it the last element between the bar and the well that is a control at all.
- **`conv.menu.hint` is a teaching line**, read once and skipped for ever after. 18.6 px. It could
  join the panels' own drag hint, or a closed fold.
- With both, **the chrome above the viewer with the panels open would be ≈ 0**, and the well could
  take the height the card is not using.
- The header is already one line and the private-things fold is already closed. Neither has anything
  left to give without losing a fact.

**The recommendation, plainly:** do the two above and give `.tvscroll` a height derived from the
viewport rather than a fixed 700, and the viewer becomes the screen. It is a layout change on a
surface three lanes have been in today, so it wants its own item and its own measurement rather than
being tacked onto this one.

---

# 9. FOUND AND DELIBERATELY NOT CHANGED

**`conv.find.moved` is a string in both tables that no screen names.** *"The find box and the match
stepper are in the search panel while it is open."* Written for `semantic/9` and never wired —
presumably as a strip placeholder saying where the borrowed controls went. It is exactly the shape
`strings-parity` cannot catch: that gate compares en against he (both have it) and the mockup against
the tables (the mockup declares no `conv.*` key at all), and the per-screen gate runs screen → tables
only. Left alone rather than wired, because putting three such lines back into the strip is the
opposite of this item. **Recorded so it is a decision rather than something nobody noticed.**

**The count and the place both name the total**, so the strip reads *"636 marked point(s) here. You
are on 1 of the 636 marked points here."* The redundancy is real. The wording is `semantic/14`'s,
adopted deliberately for consistency across the three walks; whether the count should drop its total
now that the place carries one is **the owner's to look at**, once he has seen both.

**`e2e/mark-hues.spec.ts:848` was reading two controls it did not mean, and it fails on HEAD.**
`.tvnavstep` stopped meaning "the four steppers that have a key" on 2026-09-16, when `semantic/8`
gave the MATCH stepper the same class. Verified against HEAD with every one of this lane's source
files reverted: **it fails there too.** Repaired here, by naming the two groups the assertion is
about, because this is the lane that found it.

**`e2e/screen-parity.spec.ts` fails on this machine, on HEAD, for the `preview` screen.** Its own
load guard — *"still fetching (1 `/api` reads in flight) after 25 samples over 10 s… This is a LOAD
failure"* — or, run alone, `TypeError: fetch failed / ECONNRESET`. Reproduced with every source file
of this lane reverted to HEAD, so it is contention on a machine running several lanes, not a ledger
change. **No `KNOWN_GAPS` entry was touched**, and none needed to be.

---

# 10. FILES TOUCHED

```
  src/ui/public/screens/conversations.js   the two panels, the borrow, the cascade, the standard
  src/ui/public/styles.css                 the copy panel's stack, the place slot, .tvrownow
  src/ui/public/strings/en.js              14 new keys, 1 rename, 5 rewrites
  src/ui/public/strings/he.js              the same, in Hebrew
  e2e/conversations-panels.spec.ts         NEW — 10 tests x 2 languages
  e2e/conversations-find-panel.spec.ts     `dialog.mcpanel` -> the search panel by name
  e2e/conversations.spec.ts                the instruction is its own element now
  e2e/mark-hues.spec.ts                    a stale selector, failing on HEAD, repaired
  src/ui/public/lib/panel.js               NOT TOUCHED. Zero lines. That is the finding.
```

# 11. GATES

```
  git status src/rules/entries/            clean — nothing modified, nothing staged
  node --check on conversations.js         passes
  no raw NUL byte in any file touched      verified by byte count
  removeTree, never rmSync                 e2e/conversations-panels.spec.ts uses it
  one @basis line                          8 ids
  npm test NOT run                         targeted runs only, per the lane brief
  no git command that writes                none run
```

# 12. WHAT WOULD MAKE THESE NUMBERS WRONG

The strip heights are this session, this width, this query. A narrower window rewraps every group and
a session with no marks draws a different sentence in `markCount`. What the suite asserts is the
SHRINK and the emptiness of `.tvnav`, not any single figure.

The 56.98 px figure is `.tvbar` plus the right-click instruction plus their margins. It is the floor
of what this screen can be WITHOUT the reshaping in §8, not the floor of what it could be.
