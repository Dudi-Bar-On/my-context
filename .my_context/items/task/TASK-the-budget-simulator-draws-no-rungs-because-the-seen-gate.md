---
id: TASK-the-budget-simulator-draws-no-rungs-because-the-seen-gate
type: task
title: the budget simulator draws no rungs because the seen gate empties every tier before it picks candidates
status: active
severity: soft
always: false
summary: The simulator shows a measured-empty message instead of its graph, because the seen gate removes every candidate before a tier can admit any.
summary_of: c81f55c31e2effe8
scope:
  - src/ui/public/screens/simulate.js
  - src/ui/read-model.ts
  - src/core/select.ts
tags:
  - v2
  - ui
  - injection
  - budget
  - regression
  - "plan:budget"
  - "seq:12"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: c2aa49780835f2f5
plan: budget
seq: "12"
state: done
priority: "1"
verified_on: 2026-09-04
---

# the budget simulator draws no rungs because the seen gate empties every tier before it picks candidates

Reported by the owner on 2026-09-04, looking at the running screen. Where the graph should
be, every rung reads: no rung to draw, the seen gate removed 134 items before this tier
picked candidates, leaving none to admit, empty for a measured reason and not unknown.

The message itself is behaving correctly and is not the bug. It exists precisely so an empty
rung is distinguishable from an unmeasured one, and it is doing that job. What it is
reporting is the defect: the seen gate is removing the entire candidate set before the tier
runs, so there is nothing left to draw for any tier rather than for one.

The seen gate exists to stop re-delivering what a session already holds, which is right for
a live injection and wrong for a simulation. A simulator answers what WOULD be selected for
a given path under given budgets. Applying a particular session history to that question
makes the answer depend on who is asking and when, and once that history is large enough the
honest answer becomes nothing, every time, for everyone.

Establish before changing anything, because two very different faults produce this same
screen. Either the simulator is passing a real session seen-set into a projection that
should not have one, or the seen-set it passes is unbounded and has grown to cover the
corpus. Measure which. The number 134 against a corpus of 854 items is a fact worth
explaining rather than assuming.

This blocks the spilled-items list, which cannot mark an item already in context or
genuinely absent while the gate that decides that is what empties the tier.

Do not fix this by deleting the message. It is the only reason the failure was visible at
all, and a graph that silently drew nothing would have been worse.
