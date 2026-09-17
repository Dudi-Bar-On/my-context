---
id: TASK-forty-four-percent-of-the-window-is-not-the-conversation-and
type: task
title: forty-four percent of the window is not the conversation, and the card he asked me to shrink is twenty-nine pixels of it
status: active
severity: soft
always: false
summary: Redesign everything between the app header and the viewer into one compact band, losing no information, and measure what the shared status bands would cost to change.
summary_of: fad716ee1d7f4e7b
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/styles.css
  - src/ui/public/strings/**
  - src/ui/public/app.js
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - ui
  - ux
  - "plan:semantic"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: fe2d629294843e02
plan: semantic
seq: "16"
state: todo
priority: "1"
---

# forty-four percent of the window is not the conversation, and the card he asked me to shrink is twenty-nine pixels of it

THE OWNER, 2026-09-17, LOOKING AT THE CARD AFTER `semantic/15` CULLED IT: *"it refactored well and
the viewer is implementd correct including the expansion however because of status bar under it that
occupies many rows and the static info on the card above it, it still has small amount of display
rows, it’s window is too small. i want the window to become bigger from it’s top means we need to
redesigne the card info so it will become much more compact but without loosing info, it requires
reorganization of it’s layout and it’s content."*

── THE BUDGET, MEASURED BY THE MAIN SESSION ON HIS OWN SERVER AT 1280×1000 ──

    .hdr           app header                    46.0   mycontext / repo / focus / session / א‏A
    .phd           "Conversations" + badge       37.0   SCREEN TITLE
    .psub          descriptive paragraph         44.9   "Every session Claude Code has written…"
    .help          "Where these come from"       24.8   collapsed fold
    .tvhead        THE CARD                      28.7   Back / name / id / branch / size / agents / ⤴
    .convsecrets   "Things that look private"    24.8   collapsed fold
    .tvscroll      *** THE VIEWER ***           559.1   55.9% of the window
    .tvfollows     "may still be being written"  18.6
    (gaps/padding inside .body)                  57.0
    .prov          "projection already current"  26.0
    .strip         status                       111.0   FOUR ROWS

**440.9 px — 44.1% OF THE WINDOW — IS NOT THE CONVERSATION.**

── THE FINDING THAT CHANGES THE TASK, AND HE SHOULD SEE IT ───────────

**HE ASKED TO REDESIGN THE CARD. THE CARD IS 28.7 px.** Redesigning it perfectly and reducing it to
nothing buys 28.7 px of the ~206 px above the viewer.

THE REAL COST ABOVE THE VIEWER IS SCREEN-LEVEL FURNITURE THAT IS NOT THE CARD AT ALL: a page title
(37.0), a descriptive paragraph (44.9) and a collapsed fold (24.8) — **106.7 px, nearly FOUR TIMES
the card** — plus the 46 px app header. The paragraph is teaching text: *"Every session Claude Code
has written for this project, read where it lies…"*. True, useful once, and re-read never.

SO THE TASK IS WHAT HE ASKED FOR, APPLIED WHERE THE PIXELS ACTUALLY ARE: **reorganize everything
between the app header and the viewer into one compact band, losing no information.** The card is
part of that band, not the whole of it. Say plainly in your proposal how many pixels each move buys.

── WHAT "WITHOUT LOSING INFO" MEANS HERE, PRECISELY ────────────────

`INV-nothing-is-dropped-silently` is a hard invariant of this repository and it is the reason the
previous lane LENT controls rather than moving them. Every fact currently on screen must remain
REACHABLE, and anything that DISCLOSES something — that a session is still being written, that
something is private, that a projection is stale — must still reach a reader who is not hunting for
it.

THE OWNER HAS ALREADY RULED ON THE SHAPE THIS TAKES, for the mark and message counts:
**SHOW IT ONLY WHEN IT HAS SOMETHING TO DISCLOSE.** A line that says "nothing is private here" earns
no pixels; a line that says "3 things look private" earns all of them. Apply that principle, and
note where you did.

A TITLE, A TEACHING PARAGRAPH AND AN IDENTITY ROW ARE NOT DISCLOSURES and are not protected the same
way — but they are not free to delete either. A reader landing on a URL needs to know WHAT SESSION
THIS IS. Propose where that goes; `.hdr` already carries a `session` chip and may be able to carry
more.

── THE TWO BANDS YOU MAY NOT SILENTLY REDESIGN ──────────────────

`.strip` (111 px, four rows) and `.prov` (26 px) are **APP-SHELL BANDS SHARED BY EVERY SCREEN**, not
part of this screen. He named the status bar as part of the problem and he is right that it costs
him rows — but changing it changes every screen in the product. **MEASURE IT, PROPOSE FOR IT,
IMPLEMENT NOTHING IN IT.** Put the options and their cost to the owner as a separate decision with a
recommendation. That is his call, not a lane’s.

── CONSTRAINTS THAT WILL FAIL YOU IF YOU MISS THEM ────────────────

  — **FIVE HUES, TOTAL.** `DEC-the-meaning-hue-budget-is-five`: `--gold #eab308`, `--ok #22c55e`,
    `--carry #8b9ce6`, `--crit #ef4444`, `--warn #f97316`. A compaction that invents a sixth colour
    to carry meaning that used to be carried by a word is a violation. And `--crit` on `--panel` is
    **4.75:1, clearing AA by a quarter point** — it has no headroom; do not put it on a new ground
    without recomputing.
  — **THREE TYPE REGISTERS, ALREADY DEFINED** (`styles.css` ≈1490): white = a NAME, blue = a FACT
    (every unlevelled value), hue = a VERDICT. Density work that blurs those is a regression.
  — **BOTH LANGUAGES.** Hebrew is RTL; logical properties, never `left`/`right`. A dense row of
    chips is exactly where bidi goes wrong, and a bolded numeral inside a Hebrew run is the known
    trap. Drive both.
  — **THE THREE FLOATING PANELS AND THE ⤴ EXPAND CONTROL MUST KEEP WORKING.** `.mcpanel` is
    `position: fixed` against the viewport; the expand toggle is `button.icon.tvwide` with
    `aria-pressed`, mirroring `#panefloat`. The viewer has NO close, only expanded/embedded.
  — Every control keeps its keyboard shortcut and its `aria-keyshortcuts`.
  — `CONST-node-24-no-build-step`, `CONST-zero-runtime-dependencies` — no library, no build step.

── SEQUENCING, AND IT IS NOT NEGOTIABLE ───────────────────────

**ANOTHER LANE IS WRITING `conversations.js` RIGHT NOW.** Earlier today two lanes shared that
11,000-line file and NINE hunks were silently overwritten, one of which took the screen down. So
THIS ITEM IS DESIGN-FIRST: measure, design, propose, mock up in a scratch file — **and write nothing
into `src/ui/public/` until the main session tells you the file is free.**

DELIVERABLE, phase one: a proposal with a BEFORE/AFTER pixel budget line by line, the reorganized
layout, where every piece of information went, and a rendered mock-up. Name what you would need to
change and in which files. THE OWNER APPROVES THE DESIGN BEFORE ANY OF IT IS BUILT.
