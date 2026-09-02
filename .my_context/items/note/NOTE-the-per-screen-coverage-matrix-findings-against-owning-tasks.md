---
id: NOTE-the-per-screen-coverage-matrix-findings-against-owning-tasks
type: note
title: "the per-screen coverage matrix: findings against owning tasks"
status: active
severity: soft
always: false
summary: A screen-by-screen tally of known problems beside the work that would fix them, showing several screens with problems and nobody assigned to them.
summary_of: 5d86371be15584d7
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: bd31a67867ef8d08
---

# the per-screen coverage matrix: findings against owning tasks

Measured 2026-08-25, against the requirement that every screen has a task that implements it. Findings are the tree-parity count after the emphasis fix; tasks are OPEN tasks that name the screen.

  screen     findings  open tasks
  preview        5         9
  coverage       5         0   <-- NO OWNER
  gaps           1         2
  simulate      13         8
  injected       1         0   <-- NO OWNER
  watch         13         8
  ask           10         4
  doctor         8         4
  decay         18         0   <-- NO OWNER, and the largest list on the board
  graph         12         1
  status         0         2   CLEAN
  work          11         0   <-- NO OWNER
  capture        4         2
  palette        9         9
  config         6        14
  proc          17         4
  port           5         5
  packs          9         2
  docs          13         2
  tut            0         1   CLEAN
  learn          4         0   <-- NO OWNER

FIVE SCREENS HAVE FINDINGS AND NOBODY OWNING THEM: coverage 5, injected 1, decay 18, work 11, learn 4. decay and work between them carry 29 findings and no task names either screen.

READ THE ZEROES WITH CARE. The match is by keyword -- the screen s rail label, its module filename, and a `screen:` tag -- so a task that discusses a screen without naming it that way counts as absent. The zeroes are a LEAD, not a verdict, and the first thing plan:walk seq:27 does is check each one by reading.

AND A HIGH COUNT IS NOT COVERAGE EITHER. config has fourteen open tasks and four of them predate the requirement they are supposed to serve; palette has nine and none of them says what the screen IS. That is what plan:walk seq:23 exists to sort out.
