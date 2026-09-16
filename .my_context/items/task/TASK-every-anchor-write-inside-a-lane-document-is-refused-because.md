---
id: TASK-every-anchor-write-inside-a-lane-document-is-refused-because
type: task
title: every anchor write inside a lane document is refused, because /lane.html ships a ctx with no post
status: active
severity: soft
always: false
summary: "The Mark, Rename and Take it back buttons on a lane's document throw: that window's screen contract has no post."
summary_of: a6e71d575066134e
scope:
  - src/ui/public/lane.js
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - anchors
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/lane-defect.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: ff038148845a3fa5
state: done
---

# every anchor write inside a lane document is refused, because /lane.html ships a ctx with no post

FOUND BY DRIVING IT, 2026-09-16, while closing `anchors/15`
(`TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing`).

Pressing **Take it back** on a mark inside a lane document answers, in the bar, in the system's
own untranslated words:

    Refused. The wording is the system's own and is not translated: ctx.post is not a function

WHAT IT IS. `src/ui/public/lane.js` composes its own screen contract — the `ctx` object at line
131 — and that object carries `t`, `tFlat`, `api`, `navigate` and `lang`. **It carries no
`post`.** `mountDocument` in `src/ui/public/screens/conversations.js` draws the same four write
controls it draws in the app — Mark this point, Rename, Take it back, Put it back — and every one
of them calls `ctx.post`. So on `/lane.html` all four are drawn, all four are reachable by mouse
and by keyboard, and all four throw on the first click.

WHY IT MATTERS MORE THAN IT LOOKS. `anchorHref` sends a lane's mark to `/lane.html` and the app
has no route of its own to a lane document — so a LANE DOCUMENT IS ONLY EVER READ IN THE ONE
WINDOW WHERE ITS WRITE CONTROLS DO NOT WORK. Measured on this workspace the same day: 704 of
1,306 marks carry a lane id. More than half the bookmarks in the archive are on turns the reader
can only reach in that window.

It also defeats the half of `anchors/15` that asks a reader to take back ONE of a turn's two
marks: a turn that is both a table and a lane report can only be a LANE's turn, because
`laneReportAt` requires `agentId !== null`. That behaviour was verified in the browser with a
`post` supplied in the page, which is not the product.

THE TWO WAYS OUT, and it is the owner's to pick, because `lane.js`'s own header argues one of
them:

  1. GIVE THE WINDOW A WRITE. A `post` beside `readJson`, same `credentials: 'same-origin'`
     fetch. The header at `lane.js` line ~95 says this window deliberately holds no token memory
     and no skew latch and "must not pretend to" — a POST is where that argument has to be
     re-examined rather than assumed.
  2. STOP DRAWING WHAT CANNOT WORK. `mountDocument` learns which surface it is on and draws no
     write control on `/lane.html`. This is the cheaper change and the worse product:
     `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a` is his own ruling, and it
     would then be false for every mark in a lane.

WHAT IS NOT WRONG. The GETs work; the document, its marks, the kind filter, the stepper and the
counts are all correct on `/lane.html`. It is only the four writes.
