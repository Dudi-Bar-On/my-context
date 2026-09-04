---
id: TASK-the-budget-simulator-counts-spills-but-never-names-them-so
type: task
title: the budget simulator counts spills but never names them, so nothing can be acted on
status: active
severity: soft
always: false
summary: A tier reports how many items it dropped and never which, so a reader cannot see what was lost or whether it mattered.
summary_of: a0d10988c6fef09a
scope:
  - src/ui/public/screens/simulate.js
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - injection
  - budget
  - "plan:budget"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: bb589fe261fa7bf5
plan: budget
seq: "9"
state: done
priority: "1"
verified_on: 2026-09-04
---

# the budget simulator counts spills but never names them, so nothing can be acted on

Owner ruling 2026-09-04, and the first of three to build because it makes the other two
decidable. The thresholds table reports Tier, Budget, Fits and Spills, and Spills is a number.
A reader learns that three items were dropped and never which three, so there is nothing to
judge and nothing to select.

Measured across the whole audit history the same day: 46,316 items injected and 12,034
spilled, twenty-one percent. The most-spilled are the governing ones, one rule losing its
budget contest 278 times.

What to build: list the spilled items, and mark each ALREADY IN CONTEXT or GENUINELY ABSENT.
Both facts already exist and are simply not joined. The carried tier is defined in select.ts
as ids already delivered into the current context window, and the seen file records what a
session has received. Without that mark a reader would re-deliver something the agent already
holds, which spends budget to change nothing.

This is display over data that exists, and it depends on neither of the other two rulings.
It also produces the evidence for the admission-order decision, by showing what is actually
being lost rather than how much.
