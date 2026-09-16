---
id: TASK-the-marks-card-sits-1-3-screens-below-the-fold-under-a
type: task
title: the marks card sits 1.3 screens below the fold, under a session list taller than the viewport
status: active
severity: soft
always: false
summary: The bookmarks card is no longer more than a screen below the top of the page; the list above it is capped so both are reachable.
summary_of: 615cb4808b3226d7
summary_was:
  - 2026-09-16 Your bookmarks are on the Conversations screen but you have to scroll past everything else to reach them.
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/styles.css
  - e2e/**
tags:
  - v2
  - recall
  - ui
  - "plan:anchors"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 0c71586fe63087e1
plan: anchors
seq: "8"
state: done
priority: "1"
verified_on: 2026-09-16
---

# the marks card sits 1.3 screens below the fold, under a session list taller than the viewport

FOUND 2026-09-15 BY THE OWNER OPENING THE VIEWER AFTER A REBUILD AND REPORTING HE COULD NOT FIND
HIS MARKS. They were all there — 1,156 of them, the card drawing correctly. He could not reach it.

MEASURED in the browser at 1280x1299:
    Sessions            starts   188px   height 1,302px
    Search what was said         1,502px         181px
    Points you marked            1,695px       2,082px
The marks card begins 1.3 SCREENS DOWN, below a session list TALLER THAN THE WHOLE VIEWPORT. A
reader who opens Conversations to look at his bookmarks sees a session picker and nothing else.

AND THE ORDER IS NOT WRONG BY ACCIDENT — it is the order the screen was built in, when the session
picker was the only thing on it. Marks were added underneath and nothing re-decided what a reader
comes to this screen FOR. This is the same failure as `anchors/4` (controls off-screen while
reading) at the level of the screen rather than the document.

WHAT NOT TO DO. Do not simply move the card to the top: the session picker is how a reader OPENS a
conversation, which is the screen’s other job, and burying it would trade one complaint for its
mirror image. Whatever is chosen must serve both, and the lane says which it chose and why.

OPTIONS, each with its cost:
  1. COLLAPSE THE SESSION LIST past a few rows, with a count and a way to open it. Cheapest, and it
     makes the screen readable at a glance — but it hides a list some readers scan.
  2. PUT THE MARKS CARD FIRST and the sessions under it. Straightforward, and it demotes the
     screen’s other purpose.
  3. A LINK AT THE TOP that jumps to the marks card. Adds a control and moves nothing — but a
     control that only scrolls is thin, and D58 is about exactly that.
  4. CAP THE SESSION LIST’S HEIGHT and let it scroll inside its own card, so every card on the
     screen is reachable without the page growing past a screen or two.
RECOMMENDATION: 4, then measure again. It keeps both jobs, changes no order, and the bound is the
shape this screen already uses for the mark list itself (`BOUND_CAP_LIST`).

THE MEASUREMENT THAT CLOSES IT: from a cold load of Conversations, the marks card is reachable
without scrolling, or reachable in one gesture that the screen names. Measured, at the same
viewport, and reported as a number the way this one was.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `2f25357c`. It took this item's own option 4 — cap the session list — and says why it refused the other three. The rows region went 970 px to 286, the marks card 1,786 to 1,102 with its heading ending at 1,135, and the page scroll 4,529 to 3,864.

THE ITEM'S NUMBERS WERE RIGHT IN SHAPE AND WRONG IN DETAIL, and the correction matters for the next reader: the fold is 1,162 and NOT 1,299, because `<body>` hides its own overflow and `main.body` is what scrolls, 46 px down and 1,116 px tall. So the card sat 624 px below the fold. The lane's first cap cleared 1,299 and missed the real fold by 44 px, caught by its own spec. Removal proof in the same run: deleting the one cap rule from the live CSSOM puts the card back to 1,648. Closed by the reconciliation in `rulings/93`.
