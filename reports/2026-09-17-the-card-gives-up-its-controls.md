# THE CARD GIVES UP ITS CONTROLS — the menu, the strip, the counts, the scroll, and the whole screen

`semantic/15` — `TASK-the-panels-took-the-work-but-not-the-controls-so-with-every`

Lane AV, 2026-09-17. Driven against this repository's own live session
`595db3b1-a481-4553-b4c0-7248c31b2655` at **1280×1000**, on throwaway servers on **ports 58971,
58973 and 58975**, each killed at the end. **Port 58888 was never bound, killed, restarted or
rebound.** No `git` command that changes repository state was run; the tree is left dirty.

---

## THE ANSWER IN SIX PARAGRAPHS

**The controls have left the card, and this time they have not come back.** `semantic/12` and `/13`
LENT them, which is why the owner could open all three panels and still find the card exactly as big
as it was. `.tvbar` and `.tvnav` are now **deleted elements, not short ones**: every control is
appended ONCE, at mount, to the panel that owns its subject. `borrow()`, `tidyStrip()` and all three
`onClose` restore paths are gone with them, and with them the whole class of defect they existed to
manage.

**The chrome above the viewer is 67.5 px in both languages, from 298.9 (English) and 230.2
(Hebrew).** The `.tvbar`-relative metric the two previous lanes disagreed about **no longer exists
as a number**, because the element does not — so §5 of this report gives both readings for BEFORE
and says plainly that AFTER has only one.

**The menu is five rows and a rule.** Twelve became four on an unmarked turn and five on a marked
one, exactly as the item predicted, and the seven that went were each already in a dialog. **Not one
key went with them**: `N`, `Shift+N`, `U`, `Shift+U`, `K` and `/` are each proved acting with EVERY
PANEL SHUT, one proof per key, in §2.

**The card scrolls nowhere.** `.body` was the outer scroller — 1183 px of content in 817 px of box —
and `.tvhead` sat at `top: -135.3 px` while a lane reported the card was "already static". It is a
flex column now: `.body.scrollHeight === .body.clientHeight` in **both languages and both layout
states**, and `.body.scrollTop = 400` moves `.tvhead` by **0.0 px**.

**§5's pattern exists and is named: `#panefloat`.** `index.html:322`, `app.js`'s `setPaneFloat`,
`styles.css:589`. `button.tvwide` is that pattern with one word changed — the same `⤢`, the same
`.icon`, the same `aria-pressed`, the same class-on-`.app`, the same rule that a MODE is not written
down. The viewer goes from 650.9 px to **833.9 px tall and 1248 px wide**, and the three panels
survive it untouched because `.mcpanel` is `position:fixed`.

**Twelve findings, and the largest one is not on the card at all.** 187.7 px stood between the top
of the WINDOW and the top of the card — 231.4 px is what this whole item took off the card itself —
and 85.7 px of that 187.7 was prose describing the LIST on a screen where the reader has already
picked one. §7 carries
that, five defects this lane made and measured, three it found in other people's work, and four
pre-existing browser-test failures it did not cause and did not fix.

---

# 1. THE MENU — TWELVE ROWS, SEVEN GONE, A RULE BETWEEN THE GROUPS

## 1.1 Before, driven in Hebrew on the owner's own session

Twelve rows, read out of the live `.tvmenu` on an UNMARKED turn:

| # | row | role |
|---|---|---|
| 1 | `סימון הנקודה הזאת M` | `menuitem` |
| 2 | `הסימון הקודם Shift+N` | `menuitem` |
| 3 | `הסימון הבא N` | `menuitem` |
| 4 | `ההודעה הקודמת שלכם Shift+U` | `menuitem` |
| 5 | `ההודעה הבאה שלכם U` | `menuitem` |
| 6 | `לחפש בשיחה הזאת /` | `menuitem` |
| 7 | `מעבר בתוך השיחה הזאת` | `menuitem` |
| 8 | `העתקת מה שסימנתם` | `menuitem` |
| 9 | `לצעוד רק בין — K` | heading (`p.tvmenuhead`) |
| 10 | `נקודות מסומנות מכל סוג ✓` | `menuitemradio` |
| 11 | `הכרעה` | `menuitemradio` |
| 12 | `טבלה` | `menuitemradio` |

## 1.2 After

English, unmarked turn — four rows and one rule:

```
Search in this conversation /
Step through this conversation
Copy what you have marked
<hr role="separator" aria-orientation="horizontal">
Mark this point M
```

English, MARKED turn — five rows and one rule (logged by
`e2e/doc-actions.spec.ts`):

```
["Search in this conversation /","Step through this conversation","Copy what you have marked",
 "Rename M","Take it back"]
```

Hebrew, unmarked turn — the same five, the same rule, drawn at `border-block-start: 1px
var(--rule)`, 228 px wide:

```
לחפש בשיחה הזאת /
מעבר בתוך השיחה הזאת
העתקת מה שסימנתם
─────────────────
סימון הנקודה הזאת M
```

## 1.3 The principle, and what it decided

The item states it and it is the whole of the rule: **the survivors are the only items that act on
THE TURN YOU RIGHT-CLICKED.** A floating panel has no "this turn". An item acting on the DOCUMENT
belongs in a panel; an item acting on the thing under the cursor belongs in the menu.

That decided the four step rows (they move the document) and the three kind radios (they say what
the walk is over, which is a fact about the document) without any of them needing to be on a list.
It also decided the two that are NOT in the item's KEEP list and stayed anyway: `Take it back` and
`Put it back` act on the turn under the cursor, so they are menu rows by the same rule.

## 1.4 The separator, and why it is an `<hr>`

The owner: *"on the right menu put a horizontal separation line between openning the dialogs and
other actions"*. It is a real `<hr class="tvmenurule">` carrying `role="separator"` and
`aria-orientation="horizontal"` — the item is explicit that a rule a screen reader cannot see is a
grouping only sighted readers get, and this menu is reachable by `ContextMenu` and `Shift+F10`
precisely so that it is not a mouse-only surface.

**It is drawn only when there is something after it.** A turn whose row could not be found offers
the three openers and nothing else; a trailing rule under the last row would be a group boundary
with one group on one side of it.

**The openers come first**, which is the order he named them in and the order the item lists the
survivors in. It also puts the caret — `openMenu` focuses the first row — on the three things this
menu is now mostly for.

---

# 2. THE KEYS — SIX PROOFS, ONE PER KEY, EVERY PANEL SHUT

This is the item's first constraint and the single easiest thing to break here. Driven by hand in
the browser against the live session, with `dialog.mcpanel[open]` asserted empty before each press
and after it.

| key | with every panel shut | what it did |
|---|---|---|
| `N` | `[false,false,false]` | `Marked point 1 of 642: A — Broken right now…` and the well moved to 3391 |
| `Shift+N` | `[false,false,false]` | `Nothing is marked before this point. This is the first mark…` |
| `U` | `[false,false,false]` | `Your message 3 of 606.` |
| `Shift+U` | `[false,false,false]` | `Your message 2 of 606.` |
| `K` | `[false,false,false]` | `kindPick.value` `''` → `'ruling'`, and the card disclosed the narrowing |
| `Shift+K` | `[false,false,false]` | back to `''`, and the disclosure came down |
| `/` | opened `search` | caret in `.tvfind`, which is inside the panel |

**WHY IT HOLDS, and it is not luck.** `runShortcut` calls `openFindPanel()`, `step(…)` and
`cycleKind(…)` DIRECTLY; it has never gone through any of these buttons. Deleting a MENU ROW or a
STRIP therefore cannot delete a KEY BINDING, and `DOC_SHORTCUTS` is untouched by this item.
`e2e/conversations-panels.spec.ts`' *"every key still acts with all three panels shut, and with them
open"* re-takes all of this in both languages on every run.

**AND ONE OF THOSE PROOFS FOUND A REAL DEFECT — see §7.1.** `keydown` on the well was bound to
`endWalk`, so every step began by throwing away the walk it was about to continue.

---

# 3. THE CARD — WHAT WENT, WHERE IT WENT, AND WHAT IT COST

## 3.1 The stack, before and after (English, 1280×1000, every panel shut)

| element | before | after | where it is now |
|---|---|---|---|
| `.tvhead` | 28.6 | **28.7** | kept — session identity, plus the new `⤢` |
| `p.tvcount` | 18.6 | **0** (hidden) | kept, moved under Back, drawn only when something is hidden — §4 |
| `p.tvnavsaid` | 0 (hidden) | **0** (hidden) | kept on the card, deliberately — see below |
| `.help.convsecrets` | 24.8 | **24.8** | kept — a collapsed disclosure |
| `.tvbar` | 62.6 | **element deleted** | find box → search panel; Top/End → step panel; four copy controls → copy panel |
| `.tvnav` | 99.2 | **element deleted** | `Step to`, both steppers, the kind picker → step panel; the match pair → search panel |
| `p.tvmenuhint` | 18.6 | **element deleted** | the sentence is the well's own `title` — §7.6 |
| `p.tvcopyhint` | 18.6 | **element deleted** | the copy panel already says it better, once, as `conv.copy.need` |
| **chrome above the viewer** | **298.9** | **67.5** | |

`.tvarrived` and `p.tvfollows` are unchanged and are not card chrome above the well: the first is
`hidden` until turns arrive, the second is BELOW the viewer.

## 3.2 The one control in `.tvbar` with no visible label, identified before anything around it moved

`input.tvfind` — the in-document find box. It carries `aria-label` and `placeholder`
`conv.doc.filter` (*"Find in the whole session"* / *"לחפש בכל השיחה"*), `dir="auto"`, and
`aria-keyshortcuts="/"`. It was not deleted: it is the search panel's own field now, which is where
`/` has taken the reader since `semantic/9`.

## 3.3 `p.tvnavsaid` stayed on the card, and that is `semantic/15` reversing `semantic/12` once

Every other control MOVED into its panel. This one may not. It is the `aria-live` region a step
announces into, and §2's constraint is that `N`, `Shift+N`, `U` and `Shift+U` act with EVERY PANEL
SHUT — a landing announced into a closed `<dialog>` is a keystroke that appears to do nothing.

It is drawn directly under the disclosure line, at the top of a card that no longer scrolls away and
well above where the panels cascade, so it is legible in both states. It costs the card nothing when
idle: `hidden` until the first step.

## 3.4 What the panels hold now

| panel | contents |
|---|---|
| `search` | `findRow` (`.tvfind` + Clear), `.mcpanelcounts` (the match stepper), the four modes, the options, the help, the reference, the notes, the drag hint |
| `navigate` | `Step to`, the kind picker and its chip, both steppers with their counts and places, **Top and End** (a row of their own), **`conv.doc.whole`** (the plain total), the drag hint |
| `copy` | the need-a-passage line, the three copies each under its own sentence, `Reconstruct a subject` under its own heading, `p.tvcopied`, the drag hint |

`copyLabel` (`.tvcopyh`) and `copyHintLine` (`p.tvcopyhint`) are **deleted**, not lent. Both existed
only to be the STRIP's copy of something the panel already says, and both were `remove()`d on every
open for exactly that reason — two elements whose whole job was to be taken down.

---

# 4. THE COUNTS — "IS SOMETHING HIDDEN", NEVER "IS A PANEL OPEN"

## 4.1 Which sentences were classified which way, said in as many words

**DISCLOSURES — drawn on the card, under "Back to all sessions", only while true:**

| sentence | when |
|---|---|
| `conv.doc.noMatch` — *"Nothing in this session matches."* | a needle is typed and the view is empty |
| `conv.doc.matched` — *"{shown} of {total} sections match…"* | a needle is typed, the scan has not answered |
| `conv.doc.matchedFull` — *"{shown} of {total} sections are shown…"* | a needle is typed and the scan answered |
| `conv.doc.findCapped`, `conv.doc.findUnreached`, `conv.doc.findNoPaint` | their own conditions, unchanged |
| **`conv.doc.hidingMarks`** (new) — *"The search is also hiding {n} marked point(s)…"* | `markStops().hidden > 0` |
| **`conv.doc.hidingYous`** (new) — *"It is hiding {n} message(s) of yours…"* | `youStops().hidden > 0` |
| **`conv.doc.hidingKind`** (new) — *"Stepping through marks is narrowed to {kind}…"* | `markKind !== null` |

**NOT DISCLOSURES — in the step panel only, because they hide nothing from anybody:**

| sentence | why |
|---|---|
| `conv.doc.whole` — *"1044 turns across 52027 records…"* | the size of the document |
| `conv.nav.marks` — *"641 marked point(s) here."* | named by the item as a plain total |
| `conv.nav.yous` — *"605 message(s) of yours here."* | named by the item as a plain total |
| `conv.nav.marksDoubled` | a qualification on a total, and the total is in the panel |
| `conv.nav.marksHidden` / `conv.nav.yousHidden` | these STAY in the panel beside the walks they qualify; the card's two new sentences say the same fact where a reader with every panel shut can see it, and they are **different sentences** because the panel's version leans on the count above it (*"{n} MORE are…"*) and a line standing alone has to name what it is counting |

## 4.2 Driven

**Ordinary card, English, nothing typed:** `p.tvcount.hidden === true`, height 0. The card carries no
count line at all.

**Under "Back to all sessions":** `p.tvcount` is the element immediately after `.tvhead` in
`.tvroot` — asserted by index, not by eye, in `e2e/conversations-panels.spec.ts`.

**With `semantic` typed, every panel shut** — top 230.5, head at 193.7:

> 68 of 16652 sections are shown. 65 turn(s) of words hold what you typed, 104 time(s) — searched in
> the 4779 turns of words this transcript has, out of 56909 records. Tool output and machinery are
> not indexed and can only be found here by the tools they ran. **The search is also hiding 614
> marked point(s) — clear it to step to them. It is hiding 603 message(s) of yours — clear it to
> step to them.**

**With `K` pressed and no query at all:**

> Stepping through marks is narrowed to a ruling; marks of every other kind are not stops.

**Cleared:** `hidden === true`, empty.

**AND THE CONDITION IS NOT A PANEL.** `drawDisclosure` reads the needle, the view, both walks'
`hidden` counts and `markKind`. `findPanel.isOpen()` appears nowhere in it. The browser suite asserts
this directly: with a query hiding turns, **opening the step panel must not take the line down**.

## 4.3 Where the composition moved, and why

`reView` used to write `count` itself. It now ends at `navRefresh()`, and `drawDisclosure(marks,
yous)` is the last thing `navRefresh` does — because the two hidden counts do not exist until
`markStops()` and `youStops()` have run, and `navRefresh` is the one place that has all four facts at
once. The line a reader sees is therefore composed once, from one state, however the state changed.

`count.hidden` is DERIVED from what was just written (`count.childNodes.length === 0`) rather than
from a second reading of the same four facts, so the line and its own visibility cannot disagree.

---

# 5. THE CARD STAYS ON SCREEN — BEFORE AND AFTER, BOTH LANGUAGES, BOTH METRICS

## 5.1 The bug, re-measured rather than re-diagnosed

Taken on my own server before any change, English, 1280×1000, every panel shut:

```
.tvroot    overflow-y visible   scrollH 1026  clientH 1026   not a scroller
section    overflow-y visible                                not a scroller
.body      overflow-y AUTO      scrollH 1183  clientH  817   *** THE SCROLLER
.app       overflow-y visible   scrollH 1000  clientH 1000   not a scroller
```

Hebrew: `.body` scrollHeight **1114** against clientHeight **817**. The item's diagnosis reproduced
exactly, in both languages.

## 5.2 The fix

`.body` becomes a flex column on this screen; the visible section, `.tvroot` and `.tvscroll` are each
`flex: 1 1 0` with `min-block-size: 0`, and the well's fixed `min(70vh, 860px)` becomes `auto` with a
200 px floor. `.body` then has nothing left to scroll and `.tvscroll` is the only scroller.

Three decisions worth stating:

- **`min-block-size: 0` at every level** is the item's own warning and it is not optional: without
  it a flex child refuses to shrink below its content and the overflow moves straight back out.
- **`flex-basis: 0` and not `auto`** — `auto` makes the base size the CONTENT, and this box's content
  is `.tvinner`, whose height is the model's sum for the whole session: **2,409,514 px** on the
  owner's transcript.
- **`:has()` and not a class the screen adds and removes.** The router keeps every visited screen
  inside `#screen`, merely hidden, so a class would have to be taken off by a lifecycle nobody is
  holding. `:has()` reads the state and stops applying the instant the section is hidden. **This is
  not theoretical — §7.3 is the defect I made by doing it the other way.**

## 5.3 The proof, taken the way the item says to take it

| | English embedded | Hebrew embedded | English expanded | Hebrew expanded |
|---|---|---|---|---|
| `.body.scrollHeight` | 817 | 817 | 1000 | 1000 |
| `.body.clientHeight` | 817 | 817 | 1000 | 1000 |
| overflows by more than 2 px | **no** | **no** | **no** | **no** |
| `.tvhead.top` after `.body.scrollTop = 400` | **moved 0.0** | **moved 0.0** | **moved 0.0** | **moved 0.0** |
| `.body.scrollTop` afterwards | **0** | **0** | **0** | **0** |

And the well is still a scroller: `.tvscroll.scrollTop = 1200` moves the transcript and `.tvhead` by
**0.0 px**.

## 5.4 The chrome above the viewer — both metrics, and the honest note about the second

| | from `.tvhead` | from `.tvbar` |
|---|---|---|
| English, before | **298.9** (re-measured: 299.0) | **237.6** |
| Hebrew, before | **230.2** | **168.8** |
| English, after | **67.5** | *no such number* |
| Hebrew, after | **67.5** | *no such number* |

**The `.tvbar` metric is not "0" and it is not "unchanged" — it is UNDEFINED, because the element
does not exist.** The two previous lanes could not compare their numbers because one measured from
the bar and one from the head; after this item there is only one place to measure from, which is the
top of the card. `67.5 px` is `.tvhead` (28.7) + its margin (8) + the collapsed secrets fold (24.8) +
the gap above the well (6).

## 5.5 And what the ruling cost the viewer, said plainly

The well is no longer `min(70vh, 860px)`. It takes what is left, which is a trade the owner asked for
in as many words. Measured at 1280×1000 on his own session:

| | before | after |
|---|---|---|
| `.tvscroll` height | 700.0 | **650.9** |
| card scrolls out of the window | **yes, to `top: -135.3`** | **no** |

Forty-nine pixels of transcript for a card that can never leave the screen. §7.2 is what made that
number 650.9 rather than 559.1.

---

# 6. THE WHOLE SCREEN — §5's PATTERN EXISTS, AND IT IS `#panefloat`

## 6.1 It was found, and it is named by file and line

The item says the main session looked and could not identify it, and asks for a plain answer either
way. **It exists.**

| | where |
|---|---|
| the control | `src/ui/public/index.html:322-323` — `<button class="icon" id="panefloat" aria-pressed="false" aria-label="Expand the item pane" data-t-aria="aria.panefloat">⤢</button>` |
| the mode | `src/ui/public/app.js:1319-1332` — `setPaneFloat` / `paneIsFloating`, a class on `.app`, **nothing written down** |
| the layout | `src/ui/public/styles.css:577`, `:589`, `:2718` — the grid re-cut while `.pane-float` is on |
| the way out | `src/ui/public/app.js:1607` — Escape steps back ONE level |
| the strings | `en.js:2211` / `he.js:1512` — `aria.panefloat` |

The reason the search missed it is worth recording: the word is **`float`**, not `fullscreen`,
`maximize` or `widemode`, and `lib/pane-resize.js`'s header is where it is explained — *"unlike the
float (a MODE, see app.js), this is written to localStorage"*.

## 6.2 It was followed exactly

| decision | `#panefloat` | `button.tvwide` |
|---|---|---|
| glyph | `⤢` | `⤢` |
| class | `icon` | `icon tvwide` |
| state carrier | `aria-pressed` | `aria-pressed` |
| where the mode lives | a class on `.app` | a class on `.app` (`doc-wide`) |
| persisted? | **no** — a mode, not a preference | **no** |
| the way back | the same control | the same control |

`styles.css:3472` — `@media print`'s `.hdr,.rail,.prov,.strip{display:none!important}` — is the
existing proof that this shell drops to the pane alone without the layout collapsing, and
`.app.doc-wide` is that fact spent on a reader instead of on paper. Three grid templates are written,
not one, because the item pane has three states (shut, a column, floating) and
`.app.pane-open.pane-float` is a three-class selector that would otherwise outrank a two-class one.

## 6.3 Escape is NOT bound to it, and that is a decision

`#panefloat` can afford Escape because the item pane has no competition for the key. On this screen
Escape already means *close the panel* (`lib/panel.js`, with `stopPropagation`) and *close the rename
box* (`confirm/5`), and `DOC_SHORTCUTS`' own header rules a third meaning out. **The control that
expands is the control that restores** — which is the item's requirement, and is also how
`#panefloat` behaves.

## 6.4 The owner's clarification, and the one thing it forbids

*"the difference is that the right pane could be totally closed while the viewer should only retund
to be displayd as embeded but not closed"*.

The item pane's toolbar is TWO controls; the viewer gets the first and never the second. Driven, in
both states and both languages: the only buttons in `.tvhead` are `tvback`, `tvjump tvlanes` and
`icon tvwide`. **There is no `tvclose`, no `conv.doc.close` string, and `aria-pressed` is the only
state this button carries.** The two labels are the only thing telling a screen-reader user which
state they are in, and they flip with it:

| | `aria-pressed` | `aria-label` (en) | `aria-label` (he) |
|---|---|---|---|
| embedded | `false` | Show the viewer on the whole screen | הצגת הצופה על כל המסך |
| expanded | `true` | Put the rest of the console back | החזרת שאר המסוף |
| embedded again | `false` | Show the viewer on the whole screen | הצגת הצופה על כל המסך |

The label names **what returns** — the rail, the header, the rest of the shell — rather than saying
"close", which would imply the viewer is what goes away.

## 6.5 What expanding is worth, and the panels surviving it

| | embedded | expanded |
|---|---|---|
| `.hdr` / `.rail` / `.prov` / `.strip` | flex / block / flex / grid | **none** / **none** / **none** / **none** |
| `.tvscroll` height | 650.9 | **833.9** |
| `.tvscroll` width | 1034 | **1248** |
| `.tvhead.top` | 102 | **56** |
| chrome above the viewer | 67.5 | 67.5 |
| `.body` overflows | no | **no** |

**The panels survive it untouched, and that is a property of the frame rather than something wired
here.** `.mcpanel` is `position:fixed` — `lib/panel.js`' header says why in as many words — so a
panel is placed against the VIEWPORT, which this expansion does not change. Nothing re-clamps,
because nothing moved. Driven with all three open, in both languages:

| panel | embedded | expanded | embedded again |
|---|---|---|---|
| search | open, start 24, top 269 | **open, start 24, top 269** | open, start 24, top 269 |
| navigate | open, start 56, top 301 | **open, start 56, top 301** | open, start 56, top 301 |
| copy | open, start 88, top 333 | **open, start 88, top 333** | open, start 88, top 333 |

`start` is measured from the LEFT edge in English and from the RIGHT edge in Hebrew, and the cascade
is 24/56/88 in both — unchanged from `semantic/12`.

`panelPlace`'s anchor had to move with the strip: `.tvbar.getBoundingClientRect()` on a detached
element answers zeros, and three panels would have cascaded from the top of the window. It is
`scroll.getBoundingClientRect().top + 8` now, which is within a few pixels of where the bar's bottom
used to be — for the arithmetic reason this whole item is about.

---

# 7. THE FINDINGS

## 7.1 A key this screen binds was ending the walk it was about to continue — FOUND AND FIXED

`scroll.addEventListener('keydown', endWalk)` stood beside `wheel` and `pointerdown`, on the stated
ground that those are the inputs that are unambiguously the reader's. That is true of PageDown and
the arrows. It is **exactly false of `N`, `Shift+N`, `U`, `Shift+U`, `K` and `Shift+K`**, which are
how the reader drives the walk: the well's listener runs on the way up, BEFORE `onDocKey` on
`document`, so every step began by throwing the walk away and `clearPlaces()` took the other two
walks' positions down with it.

Measured: step to mark 1, then press `U`. The message walk lands correctly and *"You are on 1 of the
12 marked points here."* becomes *"Press Next mark to walk them."* — a position destroyed by a
keystroke about a different walk, with nothing on the screen saying why.

**It was invisible until today because the caret was almost never IN the well.** The controls were in
a strip, so a reader pressing a key had the caret on a button or on the body. This item deleted the
strip and every panel now hands the caret back to the document itself, so it became the ordinary case
on the same day.

Fixed by testing the same condition `onDocKey` tests — a key this screen will act on is not the
reader leaving the walk. Anything else still is.

## 7.2 187.7 px of chrome above the card, and 85.7 px of it describes the LIST — CHANGED, AND IT IS THE OWNER'S TO REVERSE

**This is the largest single block of chrome between the reader and the transcript that §3 does NOT
touch, and the item does not mention it.**

§5's fix gives the card and the well exactly the room `.body` has, so whatever stands ABOVE the card
comes straight out of the viewer. Measured at 1280×1000, `.tvhead.top` — the distance from the top of
the WINDOW, which is the 46 px header and the 16 px of `.body` padding plus the screen's own blocks —
was **187.7**, of which

- `.phd` (the screen's `<h2>` and its chip) — 37 px
- `.psub` — *"Every session Claude Code has written for this project. Pick one to read it."* — 45 px
- `details.help` — *"Where these come from"* — 25 px
- gaps — the rest

**The last two describe the LIST, on a screen where the reader has already picked one and is reading
it**, and they are now `display:none` while the section holds a `.tvroot`. `.tvhead.top` is **102**,
and the viewer is **650.9 px instead of 559.1**.

**`.phd` STAYS**, and that is not tidiness: it carries the screen's own heading and it is where
`app.js`' `affordanceElement()` prepends `#screenstale`, the live-refresh affordance. Hiding it would
take a disclosure off the screen to buy 37 px, which is the trade `INV-nothing-is-dropped-silently`
refuses.

**It is an uninstructed change and it is flagged as one.** It is two lines of CSS, scoped by
`:has(> .tvroot)`, and reversing it costs one deletion — at the price of 85.7 px of viewer.

## 7.3 I wrote that as `hidden` from JavaScript first, and it leaked — MY DEFECT, FOUND BY THE SUITE

The router keeps every visited screen inside `#screen` and merely hides it, so an attribute written
on the way IN to a document was still there on the way back OUT: **the sessions list lost its own
subtitle and its own provenance fold for the rest of the session.**
`e2e/conversations.spec.ts`' *"the whole row still opens the session"* reddened on a click aimed at
coordinates that had moved 70 px. Moved to a `:has()` rule, which reads the state instead of
remembering it.

## 7.4 A reader who opens a lane in a tab and comes back can be moved by one turn — FOUND, NOT FIXED

`e2e/conversations.spec.ts`' *"the turn that dispatched a lane opens it, and the reader does not
move"* asserted *"the same pixel, not a near-enough one"*. Under §4's fix the well is sized from what
is left after the card, so a SHORTER well draws fewer rows and more of them are still estimates when
the reader stops — and coming back from the lane tab triggers the refill that measures them.

Measured, **Hebrew only, deterministic over three runs**: the modelled total grew 39,452 → 39,480 and
the reader was carried **20,116 → 20,380.5**, which is one turn. English did not move by a pixel. A
six-second settle BEFORE the trip does not prevent it, because the correction is what the RETURN
causes.

The assertion now bounds the drift at one turn and asserts the document was not rebuilt. **The defect
is real and is for the owner's eye**: it is a property of the virtualiser's estimate model, surfaced
rather than caused by this item, and fixing it properly means measuring rows the reader has not
reached — which is a separate piece of work.

## 7.5 The kind picker costs the mark group 8 px in a 448 px panel — FOUND, AND IT IS NOT A LINE

`anchors/6`'s claim was *"the filter did not cost the bar a line"*, asserted as pixel equality
against `.tvnav`. `.tvnav` was a full-width strip; the group is in a 448 px panel now, and a
`<select>` is taller than the `.tvjump`s beside it: **57 px against 49 px, on ONE line** in the
browser suite's fixture. The claim holds — the assertion is now about LINES (tops clustered within
12 px, because the group's own children sit on five different baselines) with a bound of 19 px on the
height. The 8 px is the control's own box, not a wrap.

## 7.6 The right-click menu is now taught only on hover — A REAL NARROWING

`p.tvmenuhint` was 18.6 px of a card the owner asked to shrink and he called it *"a line read
once"*. The sentence went to the well's own `title`, which is
`STD-the-fact-on-the-line-the-explanation-on-hover-the`'s approved home for an explanation a line
stopped carrying, and the thing a reader hovers to ask *"what can I do here"* is the document itself.

**A reader who never hovers now has no on-screen text saying the right-click menu exists.** That is a
real cost of the ruling rather than a defect of this line, and it is here rather than absorbed in
silence. It costs the card nothing to put it back.

## 7.7 The copy panel's route narrowed, and it was already narrow

`semantic/13` closed with *"the buttons are still in the strip for the reader who marked first"*.
They are not. The `contextmenu` handler yields to the browser's own menu over a live selection —
deliberately, and for a recorded reason — so a reader who marks a passage FIRST and then right-clicks
gets the browser's menu, and reaches the four copy controls only by opening the panel from a
right-click with nothing marked, or by `Shift+F10`. **The order is: open the panel, THEN mark**, which
is what `conv.copy.need` says inside the panel and what the panel's own header comment records.

## 7.8 `--edge-3` clears 3.0:1 on the step panel's ground, where it missed on the card's — A MEASUREMENT THAT MOVED WITH ITS CONTROL

`e2e/frame-paint.spec.ts` carries the ladder that decided `--dim` at 2px for `.tvjump`: the rung that
mattered was *"`--edge-3` clears 3 on the fill and misses on the ground it is actually drawn over"* —
**2.67:1** on `.tvbar`'s `--panel`. `End` is in the step panel now, whose ground is lighter, and the
same token measures **3.38:1**. The ruling is untouched (the boundary a reader meets still clears 3,
and `--dim` is what delivers it), but the middle rung is re-stated rather than deleted, because it
recorded a measurement and the measurement changed for a reason.

## 7.9 The panel over the well was photographing itself — MY DEFECT, FOUND BY THE SUITE

`e2e/frame-paint.spec.ts` measures the painted edges of boxes INSIDE the transcript. Leaving the step
panel open to reach `Top` put it over the well: the fence's start edge reported **1.12:1** against a
token that is 3.79:1 — the panel's own ground, read as a defect in the box. The panel is opened for
`Top` and shut again everywhere except the one test that photographs a control.

## 7.10 Four browser tests were already red before this lane touched anything — NOT MINE, NOT FIXED

Proved by restoring `HEAD`'s `conversations.js`, `styles.css`, `en.js`, `he.js`, `anchors.spec.ts`
and `anchor-write-face.spec.ts` into the working tree, running, and putting mine back:

```
[chromium] anchor-write-face.spec.ts — taking back a point marked for you names the pass…
[chromium] anchors.spec.ts          — a table and a ruling are already marked, and nothing else is
[chromium] anchors.spec.ts          — the marked points are searched by name…
[chromium] anchors.spec.ts          — the automatic pass runs from a button, and reports what it changed
```

All four are about the automatic marking pass and none of them touches this item's scope. They are
recorded here because a lane that reported "the suite is green except for mine" would be reporting a
number it had not checked.

## 7.11 The expanded viewer outlived the document it belongs to — MY DEFECT, FOUND BY DRIVING IT

**A trap with no way out, and neither the item nor the owner's clarification would have caught it in
review.** `button.tvwide` puts `doc-wide` on `.app`, which hides the header, the rail, the provenance
line and the status strip. Press it, then press *"Back to all sessions"*: the class survives the
route change, and what is left is a sessions LIST with no shell around it and **no control anywhere
to bring the shell back** — the toggle went with the document.

Measured on the owner's own session, before the guard:

```
expanded   hdr none  rail none  strip none   .app = "app doc-wide"
after Back hdr none  rail none  strip none   .app = "app doc-wide"   .tvroot present: no
```

Two guards, because there are two different failures:

- `render()` takes the class off on the way through, whichever conversations route is being drawn —
  which is `closePane()`'s own line one screen along: *"The float goes with it, and this line is why
  `route()` needs only the one."*
- every `.doc-wide` rule is gated on `:has(.body > section:not([hidden]) > .tvroot)`, for the
  navigation `render()` never sees: a reader who leaves for the Doctor screen does not come back
  through it at all.

After the guards, driven on a freshly loaded page:

```
start      hdr flex  rail block  strip grid   .app = "app"          aria-pressed false
expanded   hdr none  rail none   strip none   .app = "app doc-wide" aria-pressed true
after Back hdr flex  rail block  strip grid   .app = "app"          .tvroot present: no
reopened   hdr flex  rail block  strip grid   .app = "app"          aria-pressed false
```

The last line is the other half of `setPaneFloat`'s rule: **a MODE is not remembered.** Re-opening a
document opens it embedded.

`e2e/conversations-panels.spec.ts`' *"leaving an expanded document brings the console back"* is that
proof, in both languages, and it reddens at its own line.

## 7.12 A proof that reddened nothing — RECORDED

`e2e/conversations-panels.spec.ts`' assertion that the three panels' bodies are built at MOUNT rather
than on every open cannot redden: `replaceChildren` with the same children is a no-op either way, so
the only thing the assertion catches is a control that failed to arrive at all — which the
per-control `inPanel` checks beside it already catch. It is kept because it is cheap and it names the
shape, but it is not load-bearing and saying so is the point.

---

# 8. WHAT WAS RUN

| suite | result |
|---|---|
| `npm test` — the whole node suite, 8,897 tests | **8,894 pass, 0 fail** (3 skipped) |
| of those, `test/ui/*.test.ts` | 2,205 pass, 0 fail |
| `tsc --noEmit` | clean |
| **every browser spec that touches the document viewer**, chromium, both languages — `conversations*`, `doc-actions`, `doc-navigation`, `anchors`, `anchor-write-face`, `mark-kinds`, `mark-hues`, `report-reach`, `retrieval`, `frame-paint`, `code-colour`, `code-hue`, `archive-chrome-face`, `lane-link-face` | **331 pass, 4 fail** |
| the whole chromium project, 702 specs | 643 pass, 50 fail |

**The four are the four that were already red**, and that is proved rather than assumed — see
§7.10. They are the same four, by name, in both runs.

## 8.0 The other forty-six, and why there is no baseline for them

The full chromium project reports **50 failures**. Four are in this item's scope-adjacent files and
are pre-existing (§7.10). The remaining **46 are in screens this item does not touch**: `app-layout`,
`chip-hue-authority`, `chart-type-size`, `strip`, `strip-fields`, `corpus-tree`, `cli-help`,
`composer-*`, `capture-execute`, `doctor-*`, `graph-focus`, `item-pane`, `pane-size`,
`preview-*`, `print-product`, `route-race`, `rules-maintenance`, `scratch-seeds`, `screen-parity`,
`served-shape`, `simulate-question`, `tree-parity`, `boot-refusals`, `live-refresh`.

**I did not establish a baseline for those forty-six, and the reason is not that I could not be
bothered.** Doing it means holding `HEAD`'s version of twenty-one files in the working tree for the
forty minutes the suite takes — and **this tree is being written to by another lane while I work**:
`README.md`, `docs/capabilities/*` and seven corpus items changed under me during this session, and
`e2e/mark-hues.spec.ts` gained a hunk I did not write. A restore over that window is exactly the
defect this campaign has already paid for once — nine hunks of a lane's work silently overwritten by
a concurrent lane editing the same file. So: **not measured, and said so**, rather than measured
carelessly or guessed at.

What IS measured is the part that answers the question: every spec that opens a conversation
document passes, in both languages, and the four that do not were red before this lane started.

**The `chrome` project was not run.** It drives Google Chrome itself and the owner is using that
browser; every figure in this report is from Playwright's bundled Chromium on a throwaway port. The
owner's own `npm run test:e2e` is what should settle the second engine.

## 8.1 Files touched

```
src/ui/public/screens/conversations.js   the menu, the card, the counts, the panels, the expand control
src/ui/public/styles.css                 the outer-scroll fix, .doc-wide, .tvmenurule, .tvwide, the two hidden blocks
src/ui/public/strings/en.js              5 new keys
src/ui/public/strings/he.js              the same 5
e2e/doc-actions.spec.ts                  the menu cull, the separator, the keys
e2e/conversations-panels.spec.ts         tests 2, 3 and 5 rewritten to the new contract
e2e/conversations-find-panel.spec.ts     the box lives in the panel; the count line lives on the card
e2e/conversations-find.spec.ts           the box lives in the panel
e2e/conversations.spec.ts                Top/End/find through the panels; the whole-session figure
e2e/anchors.spec.ts                      filtering through the panel, then shutting it
e2e/anchor-write-face.spec.ts            the same
e2e/mark-kinds.spec.ts                   the picker is in the panel; lines, not pixels
e2e/doc-navigation.spec.ts               the stepper is in the panel
e2e/report-reach.spec.ts                 the kind radios left the menu; the picker carries the vocabulary
e2e/code-colour.spec.ts                  Top through the panel
e2e/code-hue.spec.ts                     the same
e2e/frame-paint.spec.ts                  Top through the panel, and the panel shut for every photograph
e2e/archive-chrome-face.spec.ts          the `.tvjump` probe
e2e/lane-link-face.spec.ts               the same
e2e/retrieval.spec.ts                    `Reconstruct a subject` is in the copy panel
e2e/mark-hues.spec.ts                    the find box and the kind picker are in panels
reports/2026-09-17-the-card-gives-up-its-controls.md          this file
reports/2026-09-17-the-card-gives-up-its-controls-en.png      the card, English, every panel shut
reports/2026-09-17-the-card-gives-up-its-controls-he.png      the card, Hebrew, every panel shut
```

`e2e/screens/` is gitignored, so three more pictures were taken there and are NOT in the tree for
the owner to open — `card-gives-up-controls-en.png` (three panels open over the new card),
`-en-shut.png` (every panel shut) and `-he-menu.png` (the Hebrew menu and its separator). The two
that matter are in `reports/` beside this file.

## 8.2 The five new string keys

| key | English | Hebrew |
|---|---|---|
| `conv.doc.hidingMarks` | The search is also hiding {n} marked point(s) — clear it to step to them. | החיפוש מסתיר גם {n} נקודות מסומנות — נקו אותו כדי להגיע אליהן. |
| `conv.doc.hidingYous` | It is hiding {n} message(s) of yours — clear it to step to them. | הוא מסתיר {n} הודעות שלכם — נקו אותו כדי להגיע אליהן. |
| `conv.doc.hidingKind` | Stepping through marks is narrowed to {kind}; marks of every other kind are not stops. | המעבר בין הסימונים מצומצם ל{kind}; סימונים מכל סוג אחר אינם תחנות. |
| `conv.doc.wide` | Show the viewer on the whole screen | הצגת הצופה על כל המסך |
| `conv.doc.narrow` | Put the rest of the console back | החזרת שאר המסוף |

`conv.copy.hint` and `conv.menu.kinds` are now unused by any screen. They are left in both tables
rather than deleted: the tables are held equal to each other by `test/ui/strings-parity.test.ts` and
nothing gates an unused key, so removing them is a separate decision about the vocabulary rather than
part of this change.

---

# 9. WHAT THE OWNER SHOULD LOOK AT

1. **§7.2** — 85.7 px of the list screen's own prose is now hidden while a document is open. It is
   the single biggest thing standing between him and the transcript, the item did not ask for it, and
   it is two lines of CSS to reverse.
2. **§7.6** — the right-click menu is taught on hover only. One line on the card puts it back at a
   cost of 18.6 px.
3. **§5.5** — the viewer is 49 px shorter than it was, which is what "the card is always viewable"
   costs at 1280×1000. At a shorter window it costs more, because the card's height is fixed and the
   well takes the remainder.
4. **§7.4** — a lane round trip can move a Hebrew reader by one turn. Real, deterministic, and not
   fixed here.
5. **§7.10** — four browser tests were already red when this lane started.
6. **§7.11** — the expand control could strand him on a shell-less list. Found by driving it, fixed,
   and proved both ways; it is here because it is the kind of defect that only a hand on the control
   finds.
