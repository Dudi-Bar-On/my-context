---
id: TASK-the-ground-token-was-defined-and-never-consumed-the-glass
type: task
title: "the ground token was defined and never consumed: the glass had nothing to admit"
status: active
severity: soft
always: false
summary: The background the whole look depends on was written but never actually used, so the translucent panels had nothing to catch.
summary_of: 137fbf8caef70788
acknowledged:
  - state_unaudited@75ecf4d975c6cb41
scope: []
tags:
  - "plan:repaint"
  - "seq:1g"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 69270ec547a30a2d
plan: repaint
seq: 1g
state: done
priority: "2"
---

# the ground token was defined and never consumed: the glass had nothing to admit

Found by the hero-screen agent on its first screenshot, and it is the reason the direction could not have been judged before now.

Task 1 defined the ground token - the purple and teal radial gradients over #0b0c11 - and nothing consumed it. body was still painting the legacy flat paper token. So every pane was glass over a flat dark surface, admitting nothing, which is exactly the failure section 2.3 argues against: dark-tinted glass admits COLOUR but not brightness, and with no colour beneath it there is nothing to admit.

Fixed by painting body from the ground token, wired once globally because the spec requires the same ground on all 21 screens.

Recorded rather than passed over because it was a task-1 gap that task 1's own gates could not catch: nothing tests that a token is USED. A token defined and never referenced is invisible to typecheck, to the tests and to the faint checker, and visible only to someone looking at the screen.
