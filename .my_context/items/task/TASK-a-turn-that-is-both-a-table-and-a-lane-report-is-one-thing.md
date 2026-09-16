---
id: TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing
type: task
title: a turn that is both a table and a lane report is one thing wearing two hats, and the grammar made them fight for it
status: active
severity: soft
always: false
summary: When a turn is both a table and a lane report, mark it as both instead of making one kind win.
summary_of: 76a847fff098ae2d
scope:
  - src/core/anchor-pass.ts
  - src/ui/public/screens/conversations.js
  - src/ui/public/styles.css
  - test/**
tags:
  - v2
  - recall
  - "plan:anchors"
  - "seq:15"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 6d7bf7dddbaac352
plan: anchors
seq: "15"
state: todo
priority: "1"
---

# a turn that is both a table and a lane report is one thing wearing two hats, and the grammar made them fight for it

THE OWNER ANSWERED `OPENQ-does-the-table-mark-or-the-lane-report-mark-win-when-one` ON
2026-09-16, AND HE REJECTED THE QUESTION AS POSED: "table & report - if required make them 2
different anchor types with 2 distinguished marks".

Both offered branches were a PRECEDENCE — one grammar wins, the other never gets the mark. He
asked for neither. A turn that qualifies as both CARRIES BOTH, drawn so a reader can tell them
apart at a glance. That is better than either branch and it is why the question stood open.

WHAT WAS MEASURED, and it is the whole reason this matters (lane that landed `anchors/12`,
`c382b7a5`): 230 OF 419 LANE REPORTS ARE FINDABLE ONLY AS TABLES. The report IS a table, the
table grammar claims it first, and the `report` kind never gets the mark. So the kind he asked
for on 2026-09-15 is present on 189 of 419 lane reports and absent from the majority.

Counts today: `table 793 · report 189`. Under the rejected reversal: roughly `table 563 ·
report 419`. Under HIS answer neither number falls — 230 turns gain a SECOND mark.

── THE THING TO GET RIGHT, AND IT IS NOT THE DETECTOR ───────────────────

Both grammars already run and both already recognise these turns. What does not exist is a turn
HOLDING TWO MARKS, and every consequence of that is where the work is:

  — THE ANCHOR KEY. A row is keyed by `(sessionId, agentId, byteOffset)`. Two marks at one
    offset COLLIDE on that key today. Whatever you do here is the load-bearing change, and it
    reaches the store file, the index table, `anchorIdFor`, the drop path and the relabel path.
    Do not widen the key without reading what derives an id from a position.
  — THE COUNT. `N marked point(s) here` must stay truthful. Decide and SAY whether a turn with
    two marks counts once or twice, and make the stepper agree with the number.
  — THE STEPPER AND THE FILTER. Stepping by kind must reach a turn under EITHER of its kinds,
    and land somewhere a reader understands — not the same turn twice in a row without saying
    why. The kind filter must show it under both.
  — THE DRAWING, which is the owner’s actual words: "2 distinguished marks". Both kinds already
    have a glyph, a hue and a word. Two marks on one bar must not read as a bug. Watch
    `DEC-the-meaning-hue-budget-is-five` — gold/ok/carry/crit/warn — and do not mint a sixth.
  — TAKE-BACK. Taking one back must not take the other, and the bar must say which went.

── WHAT MUST NOT REGRESS ───────────────────────────────────

  — `INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when` is the standing half.
  — An `origin: owner` row is never read or rewritten by the pass.
  — `anchors/9` measured that 1,155 marks was already enough to make rare kinds hard to find.
    This ADDS 230. If that makes the list worse rather than better, say so with a number — the
    owner asked for two marks, not for a worse screen, and "if required" are his own words.
  — The pass is idempotent: a second run marks nothing new. Prove it after the change.

AND IT IS A UI CHANGE, so it is driven in Playwright before it is reported, in both languages.

## Observations
- [supersession] Replaces OPENQ-does-the-table-mark-or-the-lane-report-mark-win-when-one: The owner answered on 2026-09-16 by rejecting the question as posed: 'table & report - if required make them 2 different anchor types with 2 distinguished marks'. Both branches the question offered were a precedence, where one grammar wins and the other never gets the mark. Neither was chosen: a turn that qualifies as both now carries both.

## Relations
- supersedes [[OPENQ-does-the-table-mark-or-the-lane-report-mark-win-when-one]]
