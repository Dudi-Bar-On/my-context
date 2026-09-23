---
id: TASK-the-status-bar-takes-a-ninth-of-the-window-and-the-only
type: task
title: the status bar takes a ninth of the window and the only thing that decides what is in it is a constant
status: active
severity: soft
always: false
summary: A customization dialog for the status bar — pick the fields, see the pixel cost as you pick, tighten the rows, and let a hidden field return when it has something to disclose.
summary_of: f940e4ce408efec7
scope:
  - src/ui/public/app.js
  - src/ui/public/lib/panel.js
  - src/ui/public/styles.css
  - src/ui/public/strings/**
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - ui
  - "plan:semantic"
  - "seq:17"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 438bf7030a4cb4bd
plan: semantic
seq: "17"
state: done
priority: "1"
---

# the status bar takes a ninth of the window and the only thing that decides what is in it is a constant

THE OWNER, 2026-09-17, having declined a flat `STRIP_MAX_ROWS` change: *"i could think about an idea
to use the right menu to display status bar customization dialog that would allow the user to check
which elements to show and many some other possible customizations you can suggest, the viewer will
dynamically extend it size down according to the status bar occupied lines but not by defining MAX
ROWS - by setting up the status bar structure and content"*. And, later: *"we can also make the
lines height smaller so less space will be occupied too like it is on the terminal statusline"*.

── START FROM WHAT ALREADY WORKS, BECAUSE MOST OF THIS IS BUILT ──────

**THE STRIP ALREADY SIZES ITSELF FROM ITS CONTENT.** `fitStrip` (`app.js:5044`) starts at TWO rows
and adds one only when a group is measurably being cut, giving the extra row to whichever of
`identity`/`state` is cut MORE — "the row goes to whoever is being cut more. Measured, never
preferred." `STRIP_MAX_ROWS = 4` is a CEILING, not a target, and its own docblock says so: *"It is
not a row count — three rows is simply what today’s fields need at most widths."*

**AND THE VIEWER ALREADY EXTENDS DOWN WHEN THE STRIP SHRINKS.** The shell is a CSS grid
(`hdr`/`rail`/`pane`/`prov`/`strip`); a shorter strip hands the pane the difference with no code at
all. Measured: 4 rows → 3 gives 83 px, and the viewer goes 650.9 → ~734.

SO HIS REQUIREMENT IS NOT A NEW SIZING MODEL. **The height already follows the content. What is
missing is that HE cannot choose the content.** Build that, and the rest is already there.

── 1. THE PICKER ─────────────────────────────────────

Seventeen groups ship today: `ask` `audit` `cache` `clock` `corpus` `cost` `cwd` `elapsed` `focus`
`lanes` `limits` `model` `myctx` `repo` `session` `where` `window`. A checkbox each, grouped as the
strip itself groups them — identity and state — so the dialog reads like the thing it configures.

**SHOW THE PIXEL COST LIVE AS HE TICKS.** "this selection = 3 rows, viewer 734 px". This is the most
important control in the dialog and the reason the feature is worth building: it puts the trade in
front of him AT THE MOMENT HE MAKES IT, instead of making him discover it afterwards by looking at a
smaller viewer. It is also exactly this product’s posture — disclose the cost, do not decide for
the reader.

**NO ROW CAP ON HIS CHOICE.** If a selection needs five rows, draw five and SAY SO. A cap that
silently overrides what he ticked is the same defect as a count that vanishes. Keep
`STRIP_MAX_ROWS` only as the fallback that governs when NOTHING has been chosen — and if you reach
it with a selection, disclose the clipping rather than hiding it.

── 2. THE HARD PART: THE STRIP CARRIES DISCLOSURES, NOT JUST FACTS ────

`91 doctor notices`. `no handover ask yet — first at 90%`. `room left`. `injections this context`.
These are not decoration; they are `INV-nothing-is-dropped-silently` spent on a screen. **A
preference set once and forgotten becomes silence later**, which is the invariant arriving by the
back door rather than the front.

**SO HIDING MEANS "DO NOT SHOW ME THIS WHILE IT IS QUIET", NEVER "NEVER TELL ME".** A hidden field
FORCES ITSELF BACK when it becomes urgent — doctor notices when non-zero, the handover ask when the
window crosses its threshold, room-left when low. When it returns it must be VISIBLY a return, not
a field he thought he had turned off misbehaving: mark it, and say in the dialog which fields can do
this and why.

**THIS IS HIS OWN RULING, APPLIED HERE.** On the mark and message counts he ruled: show it only when
it has something to disclose. Same principle, same shape. Decide the urgency threshold for each
field FROM THE CODE that already computes it, and name the ones where no threshold exists — a field
with no notion of urgency simply cannot be in this set, and saying so is the honest answer.

── 3. ROW HEIGHT ────────────────────────────────────

*"like it is on the terminal statusline"*. Today `.strip .sgrp [data-f]` is `font-size:11px;
line-height:16px` (`styles.css:1491`), inside a row that measures ~27.75 px — so **roughly 12 px per
row is padding and gap, not text**. Four rows of that is ~48 px of air.

Tightening the row is worth as much as dropping one, WITHOUT HIDING ANYTHING, and it composes with
the picker rather than competing: tighter rows mean his chosen fields need fewer of them.

**MEASURED, NOT DECLARED** — the same rule the row count already follows. Drive it at 1280 and 1920,
in BOTH languages, and report the legibility floor you found rather than the number you liked.
Hebrew glyphs sit differently in a tight line and the tabular numerals need room to stay scannable.
Do not shrink the font to buy height; the strip already uses the smallest size in the console.

── 4. WHERE IT OPENS, AND WHERE THE CHOICE LIVES ─────────────────

**OPEN IT BY RIGHT-CLICKING THE STRIP ITSELF.** He said "the right menu", and the conversation
viewer’s menu is the one he had in mind — but the strip is APP-WIDE and every screen has it.
Putting an app-wide setting inside one screen’s context menu misplaces it and hides it from the
other nineteen screens. Right-clicking the thing you are configuring is also more discoverable. If
you disagree after reading `app.js`, say so with a reason.

**REUSE `lib/panel.js`.** It is the same non-modal `<dialog>` frame the three viewer panels use:
`show()` and never `showModal()`, hand-wired Escape, pointer-capture drag, RTL-reflected placement,
guarded `localStorage`, clamp, bring-to-front, focus hand-back. This is its fourth caller and it
should need no changes. If it does, that is a finding worth reporting.

**PERSISTENCE: `localStorage`, AND SAY WHY IN THE DIALOG.** The UI is read-only by construction —
`test/ui/no-writes.test.ts` holds the symbols the server may bind to an exact set — so it CANNOT
write `config.json`. The preference is therefore per-browser and does not follow him to another
machine. That is a constraint to state plainly, not a defect to hide.

**AND IT SHOULD PERSIST, WHICH IS NOT A CONTRADICTION OF `#panefloat`.** `setPaneFloat` deliberately
does not survive a reload, for a recorded reason: *"A float that survived a reload… would greet the
next reader with a page-covering panel they never asked for."* That is a transient VIEW MODE. A
field selection is a PREFERENCE. Different category, opposite correct answer — and every read
guarded, because `localStorage` throws outright in some contexts.

── WHAT MUST NOT REGRESS ─────────────────────────────────

  — **`fitStrip` KEEPS DECIDING THE ARRANGEMENT.** It measures the deficit and picks the evenest
    arrangement that fits — owner ruling 2026-09-01, *"it also should layout more balanced and
    evenly located in the rows"*. You are changing WHAT IS IN the strip, never how it lays out.
  — **BOTH LANGUAGES, DRIVEN.** The dialog reflects in RTL and the stored place is measured from the
    RIGHT edge in Hebrew — `panel.js` already proves this; do not reinvent it.
  — **FIVE HUES** (`DEC-the-meaning-hue-budget-is-five`) and the three type registers: white = a
    NAME, blue = a FACT, hue = a VERDICT. A denser strip must not invent a sixth colour to carry
    meaning a word used to carry.
  — **EVERY SCREEN.** The strip is app-wide: check the board, the viewer and at least two others.
  — `CONST-node-24-no-build-step`, `CONST-zero-runtime-dependencies`.
  — Held by removal proofs, one per assertion, each reddening at its own line. A proof that reddens
    NOTHING is a finding to record, never to hide.
  — **THE SERVER ON 58888 IS THE OWNER’S** — never kill, restart or rebind it.
  — RUN NO GIT COMMAND THAT CHANGES REPOSITORY STATE.

REPORT the strip height and the viewer height BEFORE and AFTER, at two widths, in both languages,
for: today’s default, a tightened row with the same fields, and a reduced selection.

## Request

the design - yes, the status bar currentlly no as is but... i could think about an idea to use the right menu to display status bar customization dialog that would allow the user to check which elements to show and many some other possible customizations you can suggest, the viewer will dynamically extend it size down according to the status bar occupied lines but not by defining MAX ROWS - by setting up the status bar structure and content - tell me what you think before you do
