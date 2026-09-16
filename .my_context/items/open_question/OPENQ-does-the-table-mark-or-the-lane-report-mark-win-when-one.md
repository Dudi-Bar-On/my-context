---
id: OPENQ-does-the-table-mark-or-the-lane-report-mark-win-when-one
type: open_question
title: does the table mark or the lane-report mark win when one turn qualifies as both, and which way round is right?
status: superseded
severity: soft
always: false
summary: When one message is both a table and a helper's final answer, only one bookmark is kept — which of the two should it be?
summary_of: eb83161d95f674fb
scope: []
tags:
  - v2
  - ui
  - anchors
  - proposed
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: 2026-09-16
checksum: 043962b831f08a8c
blocks: anchors/12
---

# does the table mark or the lane-report mark win when one turn qualifies as both, and which way round is right?

RAISED 2026-09-15 BY THE LANE THAT LANDED `anchors/12` (`c382b7a5`), and carried to the
owner in the handover of 2026-09-16 as one of the three decisions no command could surface.

WHAT WAS MEASURED. 230 of 419 lane reports are findable ONLY as tables — the report is a table, the
table grammar claims it first, and the `report` kind never gets the mark. So the kind he asked for
on 2026-09-15 is present on 189 of 419 lane reports and absent from the majority.

THE CHANGE IS ONE LINE, which is exactly why this is a decision and not a task: the precedence
between the two grammars is a single ordering, and reversing it moves 230 marks from `table` to
`report` without any new code.

WHY IT IS NOT OBVIOUS EITHER WAY, and both readings are his to weigh:
  - REPORT FIRST says a lane's final answer is a different KIND of thing from a table that happens
    to be in it, and that "what did that lane conclude" is the question he actually goes back for.
  - TABLE FIRST says his own 2026-09-11 standard — "it marks a turn that MENTIONS a report, not a
    report" — cuts the other way here: the thing on the screen IS a table, and a mark that renames
    what he is looking at is a mark that lies about the page.

WHAT IS NOT IN QUESTION. Both kinds keep their glyph, their hue and their word; `anchors/12` proved
all five reach-checks on a `report` mark the pass itself wrote. The only open thing is which of the
two claims a turn that qualifies as both.

AND THE COUNTS MOVE EITHER WAY, so the answer should be given against them rather than against an
instinct: today `table 793 · report 189`; reversed, roughly `table 563 · report 419`.

## Relations
- superseded_by [[TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing]]
