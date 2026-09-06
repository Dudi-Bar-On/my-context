---
id: TASK-the-pinned-set-is-reviewed-item-by-item-still-governing
type: task
title: "the pinned set is reviewed item by item: still governing, merely true, or superseded"
status: active
severity: soft
always: false
summary: Everything injected into every session gets read once and judged on whether it still deserves to be there.
summary_of: f32bb8ecad490d59
scope:
  - .my_context/**
tags:
  - v2
  - governance
  - budget
  - "plan:governance"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 526f2410a85a8e82
plan: governance
seq: "3"
state: todo
priority: "3"
---

# the pinned set is reviewed item by item: still governing, merely true, or superseded

Owner instruction 2026-09-06, given when he authorised raising the injection budget: "in a later
time we will go over what is pinned and consider if they still relevant or should be superseded and
not occur constantly in the context."

THIS IS A REVIEW, NOT A CLEANUP, and the difference matters. A pinned item is not costly because it
is long; it is costly because it is unconditional. The question for each is whether it still earns
a place in EVERY window, not whether it is still true.

MEASURED 2026-09-06: 38 items carry `always: true`. All 38 were delivered IN FULL at the session
start measured that day - 77 items whole, 78 as index lines, and every one of the 78 was unpinned.
So pinning is currently working exactly as intended and nothing is being lost. That is the baseline
this review starts from, and it means the review is about RELEVANCE and not about pressure.

THREE OUTCOMES PER ITEM, and they are not the same thing:
  keep pinned    still governs every window
  unpin          still true, but only relevant in its scope - `mycontext unpin <id>` leaves the item
                 governing and lets jit deliver it when its scope is touched
  supersede      no longer true; `status: deprecated` or a superseding item, never deletion
Unpinning is the outcome most of these probably want, and it is NOT a demotion - a scoped item that
arrives when its files are touched is better targeted than one that arrives always.

WHAT TO BRING TO THE REVIEW, per item: when it was pinned, what it governs, whether anything has
superseded it in fact if not on the record, and whether its scope is narrow enough that jit would
deliver it anyway. The audit log can say when each was last RELEVANT rather than merely delivered -
`budget/15` is open precisely because reading an item is not audited, so "delivered" and "read" are
not currently distinguishable. If budget/15 lands first, this review gets much sharper, and that is
an argument for sequencing it after.

DO NOT DO THIS UNASKED. The owner said "in a later time". This item exists so the instruction is not
lost, not so a lane can act on it.
