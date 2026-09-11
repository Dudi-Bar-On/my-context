---
id: TASK-the-pinned-set-is-reviewed-item-by-item-still-governing
type: task
title: "the pinned set is reviewed item by item: still governing, merely true, or superseded"
status: active
severity: soft
always: false
summary: All 39 pinned items were judged one by one against the tier's own cost, and the answer is to make two of them shorter rather than to unpin ten.
summary_of: 808b20aff07bc19c
summary_was:
  - 2026-09-11 Everything injected into every session gets read once and judged on whether it still deserves to be there.
scope:
  - .my_context/**
tags:
  - v2
  - governance
  - budget
  - "plan:governance"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 718035869b7db821
plan: governance
seq: "3"
state: done
priority: "3"
verified_on: 2026-09-11
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

DONE 2026-09-11. The review is `reports/2026-09-11-the-pinned-set-reviewed.md`, and the two trimmed
bodies it measured are `reports/2026-09-11-the-pinned-set-reviewed-drafts.md`. Nothing was mutated:
no item's `always`, `severity` or `status` was changed, and `.my_context/config.json` was read only.

WHAT THE REVIEW FOUND, and it is not the outcome this item expected. All 39 pins were judged and
NONE is superseded - the tier's cost is unconditionality, and in two cases SIZE. The expectation
above that "unpinning is the outcome most of these probably want" does not survive measurement: the
spare band admits only `governs()` items, and 37 of the 39 pins are a governing type, so unpinning
one hands its tokens to the band AND puts the item into the pool competing for them. It costs +1
titled before it buys anything, and `fitToBudget` is first-fit, so a small unpin can admit one large
candidate that crowds out three. Twenty-two of the 39 measure at zero or WORSE when unpinned alone.

THE RECOMMENDATION IS TO TRIM TWO ITEMS AND UNPIN THREE. Trimming a pin by N tokens strictly
dominates unpinning a governing pin worth N, by exactly one titled item, and the trimmed item goes
on being delivered. The two trims recover 5,766 and take `governingSpill.titled` from 75 to 69 with
no pin removed. The three unpins add 3,239 and take it to 67 - and measured ALONE they are worth
nothing, which is why they rank below the trims.

`REF-the-d-numbers` keeps its pin: it is the only pin that is not a governing type, so unpinned the
band cannot take it and it would arrive as a title only - exactly what the pin exists to prevent.
Its 5,548 is a map plus a record, including three successive answers to "what is done under D37",
two of them explicitly superseded and all three still delivered every session.

THE NOTE ABOUT budget/15 STILL STANDS. Reading an item is not audited, so every verdict here rests
on what an item says and what still constrains it, never on evidence that anybody acted on it.

RECOMMEND, DO NOT ACT was honoured. Every edit named in the report is the owner's to make or refuse.
