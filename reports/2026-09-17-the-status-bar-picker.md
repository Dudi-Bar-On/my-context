Lane BC, `semantic/17` — `TASK-the-status-bar-takes-a-ninth-of-the-window-and-the-only`,
2026-09-17. The owner, having declined a flat `STRIP_MAX_ROWS` change: *"a status bar customization
dialog that would allow the user to check which elements to show… the viewer will dynamically
extend it size down according to the status bar occupied lines but not by defining MAX ROWS - by
setting up the status bar structure and content"*, and *"we can also make the lines height smaller
so less space will be occupied too like it is on the terminal statusline"*.

Every number below was taken by driving a browser against this repository's own live corpus on a
server this lane started on port 58992. Nothing is estimated and nothing is quoted from the item.

---

## THE ANSWER IN FOUR PARAGRAPHS

**The bar is 111 px and it is 99 px now, before he chooses anything.** Tightening the row cost no
legibility that could be found by measuring: the ink was measured per script and per glyph at the
shipped face, and the binding constraint turned out not to be Hebrew — it is the LEVEL ICON, which
is 12 px of ink in what was a 16 px line. 15 px keeps the two fields that genuinely clip
(`context`, `last-audit`) at the 2.0 px clearance this stylesheet already records as its own floor.
The font did not move.

**And when he chooses, the bar follows.** A selection that drops four groups takes the bar from
99 px to 74 px in English and to 49 px in Hebrew at 1280, and the viewer takes every pixel of the
difference with no code at all — the shell is a grid and the body is its one elastic track. The
dialog says the number while he ticks, measured off the page rather than predicted, so the trade is
in front of him at the moment he makes it.

**Hiding never became silence.** A field with a notion of urgency forces itself back onto the bar,
marked, the moment its own code calls it a warning or worse — and the thresholds are not invented
here, they are read off the classes the strip already paints. Thirteen of the thirty names have no
notion of urgency at all; the dialog prints that list, by name, under its own heading.

**Two defects were found by the owner using it and both are fixed at the cause, not the symptom.**
A category unticked could never come back, because `applyStripChoice` read the live DOM to decide
what the live DOM should be and a detached group is unreachable from there. And `Show everything
again` wrote an empty selection rather than forgetting the choice, which left the row ceiling
lifted and handed him a TALLER bar from a control that says the opposite. Both now have round-trip
proofs that redden.

---

## 1. THE MEASUREMENTS THE ITEM ASKS FOR

Window 900 px tall, this repository's live corpus, 25 fields on the bar in the default state.
Case C's selection is the `limits`, `cost`, `audit` and `where` groups unticked — eleven names:
`rate5 rate7 rate-verdict cost cache elapsed injections last-audit clock cwd corpusRoot`.

| case | lang | width | fields | groups | rows | strip px | viewer px |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A · today's default (16 px line, 3 px pad, 24/28 rows) | en | 1280 | 25 | 8 | 4 | 111 | 717 |
| A · today's default | en | 1920 | 25 | 8 | 4 | 111 | 717 |
| A · today's default | he | 1280 | 25 | 8 | 4 | 111 | 717 |
| A · today's default | he | 1920 | 25 | 8 | 4 | 111 | 717 |
| B · tightened row, same fields (15 px line, 2 px pad, 21/25 rows) | en | 1280 | 25 | 8 | 4 | **99** | **729** |
| B · tightened row, same fields | en | 1920 | 25 | 8 | 4 | 99 | 729 |
| B · tightened row, same fields | he | 1280 | 25 | 8 | 4 | 99 | 729 |
| B · tightened row, same fields | he | 1920 | 25 | 8 | 4 | 99 | 729 |
| C · tightened row, reduced selection | en | 1280 | 15 | 4 | 3 | **74** | **754** |
| C · tightened row, reduced selection | en | 1920 | 15 | 4 | 2 | **49** | **779** |
| C · tightened row, reduced selection | he | 1280 | 15 | 4 | 2 | 49 | 779 |
| C · tightened row, reduced selection | he | 1920 | 15 | 4 | 2 | 49 | 779 |

Three things in that table are worth naming rather than leaving to be read off.

**The default is four rows at 1920 as well as at 1280**, which is not what the item's own summary
assumes. The bar is at its ceiling on a wide monitor already, so `STRIP_MAX_ROWS` was not a spare
allowance waiting to be used — it was binding, in both languages, at both widths.

**Hebrew is more compact and reaches two rows at 1280 where English needs three.** The Hebrew
labels are shorter and the group headings shorter still, so the same selection fits one row sooner.
This is the first measurement on this bar where the two languages diverge in ROW COUNT rather than
in pixels.

**The strip and the viewer are exact complements.** 111 → 99 is −12 and 717 → 729 is +12; 99 → 49
is −50 and 729 → 779 is +50. `e2e/strip-picker.spec.ts` asserts that equality rather than the two
numbers separately, because it is the claim that matters: nothing else in the shell moved.

---

## 2. THE ROW HEIGHT — WHAT I FOUND, NOT WHAT I LIKED

`.strip .sgrp [data-f]` was `font-size:11px; line-height:16px; padding:3px 5px` inside 24 px and
28 px tracks. It is `line-height:15px; padding:2px 5px` inside 21 px and 25 px now. The font did
not move — 11 px is already the smallest size in this console, and buying height with it is buying
height from the reader.

**No clipping floor exists down to a 12 px line, and that was the surprise.** Driven at 1280 and
1920 in both languages, across line-heights 16/15/14/13/12 and paddings 3/2: not one pill ever
rendered taller than its declared box, and not one overhung its row. The reason is structural — a
pill carries 2 px of padding and 1 px of border OUTSIDE its line box, and the row track is sized
from the pill, so the row cannot clip what the pill contains. **The floor is ink clearance inside
the line box, not clipping**, and it binds on the two fields that are themselves `overflow:hidden`:
`[data-f="context"]` (via `.ctxstate>span`) and `[data-f="last-audit"]` (via `.sprop`).

Ink measured on a canvas using the pills' own computed font (`bold 11px Geist, "IBM Plex Sans
Hebrew", system-ui`):

| run | ascent | descent | ink |
| --- | ---: | ---: | ---: |
| Latin caps `MODEL WINDOW` | 8 | 0 | 8 |
| digits and punctuation `46.9% (469.0k / 1.0M)` | 9 | 1 | 10 |
| Hebrew `מודל חלון קורפוס ביקורת` | 8 | 2 | 10 |
| Hebrew descenders `קופץ ךןףץ` | 7 | 2 | 9 |
| bar glyphs `▰▱` | 6 | 0 | 6 |
| **level icons `⚠️🔶💀`** | **10** | **2** | **12** |
| tallest pill actually on the bar (`context`) | — | — | 11 |

So clearance per side is `(line − ink) / 2`: at 16 px the worst pill cleared 2.5 px, at 15 px it
clears 2.0, at 14 px 1.5, at 13 px 1.0, at 12 px 0.5. **2.0 px is this stylesheet's own recorded
floor** — the `1.9` rule at `styles.css:986` was raised to exactly that number, and its comment
says why: it *"is the margin a font fallback or a Hebrew glyph eats first"*. 15 px is the tightest
line that keeps it.

**Hebrew was measured separately and is not the binding constraint**, which is worth recording
because it was the expected one. Hebrew sits 2 px below the baseline against Latin caps' 0, so it
uses 10 px of the same 11 and clears identically. What binds is the level icon at 12 px — the one
thing on this bar that renders above the cap height by design — which makes 12 px a hard floor
rather than merely an ugly one.

**What he can have if he wants it, with the cost:** 14 px/2 px is a 95 px bar and a 733 px viewer
(4 px more than shipped, worst-pill clearance 1.5); 13 px/2 px is 91 px and 737 (clearance 1.0);
12 px/2 px is 87 px and 741 (clearance 0.5, and the level icon's ink exactly fills the line box).
All four were driven and screenshotted in both languages; none of them clipped. The recommendation
is 15 px because it is the last value that keeps a margin this stylesheet has already paid to
learn about, not because the tighter ones looked wrong.

---

## 3. THE PICKER, AND ONE CORRECTION TO THE BRIEF

### 3.1 The seventeen groups are not seventeen groups

The item lists *"Seventeen groups ship today: `ask` `audit` `cache` `clock` `corpus` `cost` `cwd`
`elapsed` `focus` `lanes` `limits` `model` `myctx` `repo` `session` `where` `window`"*. Measured
against the source and the live bar:

  — **Nine of them are `.sgrp` provenance groups** — `repo model window corpus where limits session
    cost audit`. That is every `group('…')` call in `app.js`.
  — **Eight are FIELD LABELS inside those groups** — `ask cache clock cwd elapsed focus lanes
    myctx`. They print in white caps on a pill, not as a group heading.
  — **The list is also incomplete by its own rule.** Five more names print on the bar exactly the
    same way and are missing from it: `5h`, `7d`, `session name`, `size`, `corpus` (the root, as
    distinct from the group).
  — **And the two levels OVERLAP.** `window` is a group that contains `ask` and `myctx`; `session`
    contains `lanes` and `focus`; `where` contains `cwd`. Seventeen independent checkboxes cannot
    be built from that list because five of them are inside others.

**What shipped instead, and it gives him every one of the seventeen without the overlap:** one
checkbox per NAME the bar prints, arranged under the group headings, with each heading itself a
check-all for its own fields. Ticking `WHERE` ticks `cwd` and `corpus`; ticking `cwd` ticks only
`cwd`. Thirty names, nine headings, thirty-nine checkboxes.

**The atom is the printed name and not `data-f`, and that is load-bearing.** `COST` and `CACHE` are
two names a reader reads as two fields and share ONE `data-f` (`cost-cache`), because the parity
gates address a FACT and a reader addresses a LABEL. A picker keyed on `data-f` could not offer him
the spend without the cache share. `pickKeyOf` takes the `strip.grp.*` key off the pill's own
`.ulab` where it has one and falls back to the field id where it does not — which also, correctly,
folds the model name and the model modes into one `MODEL`.

### 3.2 The live cost readout

`this selection = N rows, bar N px, viewer N px`, redrawn after every tick. It is a **measurement,
not a prediction**: the tick is applied, `fitStrip` re-deals the bar, and the numbers are read off
the page on the next frame. There is no second arithmetic that could disagree with the layout. When
a selection is still being cut at the current width the readout says so in a second sentence
(`data-clipped="1"` beside it, so a gate can read the verdict without parsing prose in two
languages).

### 3.3 Two columns, which are the bar's own two subjects

The owner's second look: *"it's very long as a list you can layout the content more inteligently,
use the width too"*. Thirty rows in one column measured 1,006 px in a 1,000 px window.

They are laid out as IDENTITY and STATE — the split `fitStrip` already allocates rows between —
rather than as an arbitrary two-up flow, so the columns tell him which subject his ticking is
buying rows back from. Measured after: **736 px wide, 702 px tall, 667 px of content**, identical
at 1280×1000 and at 900×800 and in both languages; it fits a 1,000 px window with 298 px to spare
and scrolls inside itself below that. `lib/panel.js` needed no change for the width — it writes
`inset-inline-*` and `max-block-size` and never an `inline-size`, so the stylesheet sets it per
panel through the `data-panel` handle the frame already writes.

One placement defect was found by looking at a screenshot, which is where this panel's defects keep
being found: opening it from the pointer put it 481 px down a 1,000 px window, and `lib/panel.js`
bounds a panel's height against the top it was given, so it was clamped to 495 px with its own
`LIMITS` group and its reset link below the fold. It opens `STRIP_PICKER_H` above the gesture now —
a measured constant, because the frame has to be handed a top before the box exists.

### 3.4 Where it opens, and where the choice lives

Right-clicking **the bar itself**, on `#strip` and on the header's repo group, on every screen.
Driven on five: the board, the conversation viewer, Doctor, Status and Composer — 99 px and 25
fields on all five, in both languages. The browser's own menu is left alone over a link and over a
live selection, which is the rule `screens/conversations.js` already states.

`localStorage`, per browser, **and the dialog says so in its own words**: *"Kept in this browser
only. The web UI is read-only by construction and cannot write your config file, so this choice
does not follow you to another machine."* Every read is guarded — the property access itself throws
in a sandboxed frame — and every shape a store can lie in is refused rather than repaired.

---

## 4. THE URGENCY OVERRIDE

**Hiding means "do not show me this while it is quiet", never "never tell me".** Three answers, and
the third is the honest one.

**`level` — 14 names.** Urgent when the value's own code has banded it loud. Nothing here invents a
threshold: `bandUsage` paints `warning`/`critical` from `usageLevelOf`, a `.chip` paints
`warn`/`crit` from whichever function computed its state, and those four classes are the rule.
`caution` and `ok` are deliberately NOT loud — `caution` is the first colour a rising figure takes,
and forcing every hidden field back at gold would make the preference worthless through the
ordinary middle of a session. `warning` is where the strip itself starts drawing an ICON beside the
value and where `askVerdictChip` starts being drawn at all, so it is the bar's own existing line
between *rising* and *look at this*.

Three fields carry a disclosure with **no band to carry it**, and each is marked with `data-u` at
the site that already computes the value — never with a hue, because a count of findings is not a
level and no sixth meaning is spent here:

  — **`doctor-notices`** when the count is above zero, in `corpusNoteButtons` beside
    `doctorNoticeCount`. This is the owner's own ruling — *show it only when it has something to
    disclose* — applied to the one field that is drawn at zero on purpose.
  — **`myctx`** in its `unavailable` state, which is the one state of that field with no band,
    and which prints the corpus and the command that would repair it.
  — **`injections`** in every state that reaches `dashed()` — the endpoint did not answer, or
    answered and could not count. This field is *"the at-a-glance proof the one feature this
    product exists for is firing at all"*, so an uncountable figure is a disclosure.

**`presence` — 3 names.** `review-queue`, `ask-verdict`, `rate-verdict`. Their own code draws them
ONLY when there is something to disclose — the queue is silent at zero, the ask verdict below its
band, the rate verdict while both windows are calm — so being drawn at all IS the urgency.

**`null` — 13 names, and the dialog prints every one of them: `project branch model session name
size lanes focus items cwd cost cache elapsed clock`.** These have no notion of urgency anywhere in
the code that computes them. A name in this list, unticked, is gone until he ticks it back. Saying
so is the answer, not a gap in it — a field with no threshold cannot join the set, and a dialog
that implied otherwise would be promising a return that cannot happen.

**One threshold was considered and deliberately not taken:** an injection count of ZERO. It is the
honest state of every session before its first injection, so forcing the field back there would
make the preference worthless for the first minutes of every window — an alarm that is always on at
the start is one nobody reads. The unmeasured states are unambiguous; zero is not.

**The return is visible on the bar and named in the dialog.** On the bar it is a **dotted outline in
the field's own ink** — a shape, not a sixth hue, so `DEC-the-meaning-hue-budget-is-five` is not
spent and the outline says *this is back* without saying anything about how bad it is. In the
dialog the row turns and the readout names every field it is currently overriding, because from the
bar alone a returned field is indistinguishable from one that was never hidden.

**A limitation, recorded rather than hidden:** the on-bar carrier is a border STYLE only, with no
word and no glyph of its own. `06-a11y.html`'s rule is a glyph AND a colour AND a name, and a
returned field satisfies it only through the dialog. A glyph was the obvious answer and was not
taken: `test/ui/glyph-set.test.ts` holds the emoji ledger to equality in both directions, and
spending a mark there is a ruling about the app's glyph vocabulary rather than a detail of this
item. Worth his eye.

---

## 5. THE TWO DEFECTS HE FOUND, AND WHERE THEY WERE

### 5.1 A category could leave the bar and never come back

*"when you deselect a category after reselction the fields does not come back and are not
displayable again"*. A cycle with no exit:

1. untick every field in a group → every pill takes `.stripoff`
2. `stripGroupsOf` drops the group, so `layoutStrip` never appends it — the group is now
   **detached** from `#strip`
3. re-tick → `applyStripChoice` scans `#strip`'s live DOM, which no longer holds those pills, so
   their `.stripoff` is never removed
4. `stripGroupsOf` still sees every field off → the group stays dropped, for ever

**The DOM is a view; `stripPlan` is the source of truth.** A function that reads the view to decide
what the view should be cannot reach anything the view has already dropped. `stripPills()` walks
`stripPlan.identity`/`.state`/`.tail` now — references survive detachment — so the pills are
reached whether attached or not, and `layoutStrip` re-appends the group on the very next pass.

It was **worse than a session bug**, which is why it is written up rather than quietly fixed: the
choice is persisted, so the loss survived a reload with no route back but the reset link; and
`applyStripChoice` is also the function that adds `.stripback`, so a detached `97 doctor notices`
could never have forced itself back. That is `INV-nothing-is-dropped-silently` failing inside the
one feature built to honour it.

The header's repo group cannot reach this — `#topbar` is never re-laid-out — but it had the mirror
defect: unticking all three of its fields left the word `REPO` standing over nothing. It is hidden
and unhidden in place.

### 5.2 `Show everything again` made the bar taller

`null` and `[]` are different everywhere else in this feature and the reset link was the one place
they were collapsed. An empty SELECTION is still a selection, so `stripRowCap` went on letting the
bar take every row its content measurably needs. Measured at 1280: **4 rows and 99 px before, 5
rows and 124 px after**, with the same twenty-five fields on it, from a control that says the
opposite. `clearChoice` removes the key so `readChoice` answers `null` again; the driven proof
asserts the bar, the row count and the absence of the stored key.

### 5.3 And the consequence of the cap lift, stated plainly

**Once he has chosen anything, the ceiling is his content's and not `STRIP_MAX_ROWS`.** That is the
item's instruction — *"if a selection needs five rows, draw five and SAY SO"* — and it cuts both
ways: at 1280 this corpus is genuinely cut at four rows, so a made choice that drops three fields
took the bar to **5 rows and 124 px**, taller than the 99 px default, because nothing is being
truncated any more. The readout says the number as he does it. If he wants a cap back it is one
constant, and `STRIP_MAX_ROWS` still governs every reader who has not opened the dialog.

---

## 6. PROOFS, AND THE ONES THAT REDDENED NOTHING

**`test/ui/strip-picker.test.ts` — 25 assertions, all green.** The rules half: what a stored choice
is, `null` against `[]`, which pill answers to which name, when a hidden field may come back, and
the table's own totality.

**21 removal proofs run against it. 20 reddened, each at its own line.** The store guards, the
unknown-name filter, the `null`/`[]` distinction, the array-shape check, the write guard, both
halves of `pickKeyOf`, all five branches of `isUrgent`, the duplicate-key check, both string-table
checks, the group check, the ghost-key check, the column order, and the fourth-urgency-value check.

**One reddened nothing, and it is a real limit rather than a weak test.** Declaring `clock` as
`urgency: 'level'` changed both sides of the comparison, because `neverForced()` is DERIVED from
`urgency === null` — a static test comparing the two is a tautology in that direction, and **a field
wrongly declared to have no urgency cannot be caught by reading the table.** It is closed by driving
instead: `e2e/strip-picker.spec.ts` collects every pill the bar draws loud across four payload
states and fails if one of them is a row the dialog promises can never return. (A different
mutation — rewriting `neverForced()` itself — does redden that assertion, so it is not vacuous.)

**`e2e/strip-picker.spec.ts` — 8 tests, all green.** The gesture on five screens and the page behind
staying live; the field census against the table; the trade in both languages with the
strip/viewer complement asserted as an equality; the round trip; the reset; the ceiling lift; the
Hebrew reflection and the RIGHT-edge drag.

**8 removal proofs run against it. All 8 redden** — but three of them reddened NOTHING on the first
pass, and each was a hole in the proofs rather than in the code:

  — **the ceiling lift was unheld.** No assertion touched it. Added, with the vacuity guard that
    makes it mean something: the clipped verdict is read off the dialog first, and the claim is
    made only where there is a ceiling to lift. (And the case no black-box test can separate is
    named in the test: when an extra row would buy nothing, a capped bar and an uncapped one draw
    the same thing.)
  — **the hiding RULE was unheld.** Breaking `.strip .sgrp [data-f].stripoff` reddened nothing,
    because every test unticked a whole CATEGORY — and a category leaves the bar by detachment,
    which would happen even if no rule hid anything. A single field inside a group that is still
    drawn is the only case where `display:none` is the whole mechanism, and now there is a proof
    for it.
  — **the return MARK was unheld.** Removing the dotted outline reddened nothing. The assertion is
    back.

---

## 7. WHAT I FOUND THAT IS NOT MINE

**`e2e/strip-fields.spec.ts` is red, and it is red on PRISTINE sources.** Swapped `app.js`,
`styles.css` and both string tables for their `HEAD` bytes and ran it: same failure, `Received: 2`
against a floor of 10. The cause is `page.reload()` in this harness — the reload re-navigates to
the spent nonce, the boot exchange is refused, and the page comes back as chrome with no token: an
empty rail, an empty `main`, and a strip of group headings with no fields under them. Not this
item's doing, and `e2e/strip-picker.spec.ts` is written around it (a second page in the same
context with a fresh nonce) rather than through it.

**A backgrounded tab does not fit the bar, and it cost me an hour.** `fitStrip` is coalesced onto
`requestAnimationFrame`, which the engine throttles in a hidden tab — so a page opened behind
another can sit unfilled and unfitted indefinitely. Measured: the English run of one test read 2
visible fields off a bar the Hebrew run read 25 off, from identical code. `bringToFront()` before
waiting is the fix in the spec. Whether the PRODUCT should also refit on `visibilitychange` is a
real question and not mine to answer — a tab restored from the background currently keeps whatever
arrangement it had when it was hidden.

**`mintNonce` has no retry, and Node's `fetch` resets on it.** Against this server on Windows,
`test/ui/helpers.ts`' bare `fetch` intermittently answers `ECONNRESET` on a reused keep-alive
connection — three of seven tests in this file and two unrelated ones in `e2e/strip.spec.ts` in the
same run. `connection: close` plus a short backoff fixes it. The retry belongs in `helpers.ts`
where every caller would get it; this lane put it locally rather than editing a shared file.

**Three `e2e/app-layout.spec.ts` tests are red on pristine sources too** — `every row of the app
shell SAYS something`, `delivered row labels begin at one left edge`, and `the ribbon's tiers and
the ladder's states are distinguished by look`. Verified by the same swap. A fourth one (`nothing
on the audit stream screen resolves to a physical text-align`) failed only under three-file
contention and passes alone.

**`styles.css:1553` carried arithmetic that disagreed with the declaration three lines above it** —
`18px of line + 6px of padding + 2px of border = 26px` against a rule declaring 16 px and 3 px for
a 24 px pill. Corrected, with a note saying it is recomputed from the declaration rather than
restated.

**`test/ui/pane-float.test.ts` asserts over `app.js`'s BYTES, and a comment trips it exactly as a
call would.** Naming `lib/panel.js`'s non-modal open in a comment made seventeen tests about the
item pane go red, reported as *the pane never opened*. `styles.css` already carries the same
warning for the same gate one file along. The comment is reworded.

**`test/ui/pane-route.test.ts`'s document stand-in has no `classList.toggle(name, force)`**, and a
`TypeError` raised inside `renderChrome()` takes the whole shell down in that harness — which is
how a strip change surfaced as seventeen failures about the item pane. `add`/`remove` throughout
now. The stand-in also has no `parentElement` and no `matches`; both of those are optional-chained
and degrade quietly.

---

## 8. THE SERVER RECORD — ASKED, AND ANSWERED

**Yes, the product should prevent it, and the mechanism to do it already exists.**

`~/.my-context/ui-server.json` is ONE file per user and `mycontext ui` writes it unconditionally at
start and clears it at exit. A throwaway server therefore takes the record away from a server that
is still serving, and — this is the aggravated half — **clears it on the way out**, leaving the
owner's live server on 58888 with no record at all. `mycontext ui --nonce` then finds nothing to
aim at, which is not "point at the wrong server" but "conclude there is no server", and the step
after that spawns one.

Two answers, and they are not alternatives:

  — **The cheap one, available today: `MYCONTEXT_UI_SESSIONS_DIR`.** It already redirects the
    directory both files live in. This lane's measurement server was started under it and wrote its
    record to a temp directory; the global file was never touched. Any short-lived server — a lane's,
    a test harness's — should be started that way, and the `ui` command could set it itself when it
    is told the server is not the machine's primary.
  — **The right one: `writeUiServerRecord` should refuse to overwrite a record whose port still
    answers.** The module's own header already says liveness is proved by connecting rather than by
    the file, and `ui-server-probe.ts` already does the connecting. A write that probed the incumbent
    first would make this impossible rather than merely discouraged — and the same probe would let a
    clean exit decline to clear a record it did not write.

State as this lane finishes: the global `ui-server.json` does not exist. It was removed by this
lane's server exiting cleanly, and the owner's server on 58888 (pid 9700) is still listening without
one. Nothing this lane can do restores his record — the file carries a pid, a bound port, a start
time and a workspace, and inventing any of them would be writing a claim rather than a measurement.
**He should restart his own UI once, or `mycontext ui --nonce` will spawn a second server beside the
one he is using.**

---

## 9. WHAT I DID NOT DO

  — **`fitStrip`'s arrangement is untouched.** It still measures the deficit and picks the evenest
    composition that fits — owner ruling 2026-09-01. What changed is WHICH GROUPS it is handed and
    what the ceiling is, never how it deals them.
  — **`lib/panel.js` is untouched**, which is the claim `semantic/9` made for the frame when it
    shipped with one caller. Its fourth caller needed a width (a stylesheet rule keyed on the
    `data-panel` handle the frame already writes) and a fallback top computed before the box exists
    (the caller's own arithmetic). Neither is a change to the frame.
  — **No sixth hue and no new glyph.** The return mark is a border style in the field's own ink;
    the dialog's marks are `--dim` and `--warn`, both already on this bar.
  — **`STRIP_MAX_ROWS` was not deleted.** It is the fallback its own docblock always said it was.
  — **Nothing under `docs/`**, and no git command that changes repository state.
