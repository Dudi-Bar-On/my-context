---
id: TASK-the-mockup-gains-a-command-block-per-procedure-card
type: task
title: the mockup gains a command block per procedure card
status: active
severity: soft
always: false
summary: Each procedure should carry its own command, since one shared command names a single item that most of them are not.
summary_of: 33f75f4519ecd259
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - "screen:proc"
  - mockup
  - "plan:walk"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: c69484e81501e31d
plan: walk
seq: "3"
state: todo
priority: "2"
source: "plan:port seq:98, proc"
needs: port/94
---

# the mockup gains a command block per procedure card

Carries out the ruling of the same date: the procedure done command belongs to each procedure card. This is the rare direction -- the APP is right and the DESIGN OF RECORD is updated.

The mockup draws one `.cmd` block in the prose card. It must draw one inside each procedure card instead, because the command names a specific id and a shared block is wrong for every card it does not name.

THE MOCKUP BELONGS TO THE OWNER. It is not edited to make a gate green, and it has never been edited to prove a test works. This edit exists because a ruling was taken about the design itself, and the ruling is recorded beside it.

The mockup s sample scene holds one procedure, so the change is only visible once plan:port seq:94 gives it more than one. Sequence this AFTER 94 or the edit cannot be seen to be correct.

Re-measure tree-parity afterwards: findings proc #06 and #11 should be gone, and nothing else on the screen should have moved.
