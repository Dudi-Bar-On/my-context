---
id: TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing
type: task
title: the pinned tier sits half empty while sixty-nine governing items arrive as titles
status: active
severity: soft
always: false
summary: "The premise was wrong: the pinned tier is not half empty, so there is no spare capacity for governing items to use."
summary_of: 554376a9325d66b8
summary_was:
  - 2026-09-04 Normative items cannot use spare pinned budget because only always-true items are admitted to that tier.
scope:
  - src/core/select.ts
tags:
  - v2
  - injection
  - budget
  - enforcement
  - "plan:budget"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 2bc26f37c13aacf5
plan: budget
seq: "16"
state: todo
priority: "1"
verified_on: 2026-09-04
---

# the pinned tier sits half empty while sixty-nine governing items arrive as titles

Owner ruling 2026-09-04. He was shown three options and chose the admission change, with
hand-pinning as an immediate stopgap. His words were yes 3 and 2.

Measured on a real session-start injection the same day. The pinned tier reported about 7,400 of
16,000 estimated tokens, leaving roughly 8,600 unused, while 69 governing items arrived carrying
a title only. Those two facts sit side by side in the same injection. The room exists in the
right tier and nothing is allowed to use it.

The reason is admission rather than budget. Only 35 of 104 governing items are always true, so
the other 69 never compete for pinned at all and instead lose in jit, whose 16,000 is already
contested. Raising a budget was considered and set aside: delivering all 69 in full would cost
about 37,600 more tokens, and it defers the same collision to a larger corpus while saying
nothing about who loses when it is reached again.

What to build: normative items may draw on pinned budget that always-true items have not used,
so spare capacity in the tier that exists for governing items is spent on governing items. This
changes admission and raises no budget.

Decide and state the order, because it decides who benefits. Always-true items must keep
absolute precedence, since a pin is an explicit instruction and this must not silently displace
one. What fills the remainder afterwards is the real question, and the most-spilled governing
items are the obvious candidates given one rule lost its budget contest 290 times.

On the stopgap. It was approved because the admission change takes time, and if that change
lands the stopgap is not merely unnecessary but harmful, since a pin is permanent and would keep
delivering after the tier already covers the item. Measure whether a gap remains once admission
is fixed, and pin only what is still not reached, naming every item before doing it. Pinning is
a permanent mutation of a corpus that is being dogfooded.

Watch the interaction with the disclosure that shipped alongside this. Governing items not
delivered in full are now NAMED rather than silently degraded, so the count of titled items is
the measurement of whether this worked, and it should fall.
