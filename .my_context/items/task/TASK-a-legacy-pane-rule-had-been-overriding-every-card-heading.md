---
id: TASK-a-legacy-pane-rule-had-been-overriding-every-card-heading
type: task
title: a legacy .pane rule had been overriding every card heading since task 6
status: active
severity: soft
always: false
summary: An old style rule quietly took over every card heading once a name was reused, and shipped wrong for weeks because nothing measures how text looks.
summary_of: b736557227d69006
scope: []
tags:
  - "plan:repaint"
  - "seq:9c"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 40ccd7e16ba0ff62
plan: repaint
seq: 9c
state: done
priority: "1"
---

# a legacy .pane rule had been overriding every card heading since task 6

Found by repaint task 9 and fixed, but worth recording because it was ALREADY SHIPPED and nothing caught it.

The legacy rule .pane{grid-area:pane;overflow-y:auto;padding:var(--sp-3)} was written when the item-detail aside was the only element carrying a bare .pane - which is exactly what task 3 left untouched, correctly, at the time. Task 9 then put .card.pane on 37 cards, and the legacy rule matched every one of them: two grid cards fought over the same named grid line and collapsed onto each other full width.

e2e/states.spec.ts caught THAT as an unclickable tree row. The agent confirmed the test passed on unmodified HEAD first - via a saved patch and git checkout, not stash - so the change was provably the cause.

The second bug had no test at all: .pane h3 sits later in source with the same specificity as .card>h3, so every card heading in the file had been rendering at 16px/4px instead of 13px/8px since task 6 landed. Nobody saw it because nothing measures a heading's computed size.

The fix rescopes the whole legacy block from .pane to #pane, the aside's own id - identical behaviour for the one element it was written for, no leak onto anything else.

The lesson generalises: a bare-element rule is safe exactly until a primitive with the same name is applied somewhere else, and specificity ties are decided by source order, which nobody reads.
