---
id: TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing
type: task
title: the pinned tier sits half empty while sixty-nine governing items arrive as titles
status: active
severity: soft
always: false
summary: The admission change shipped and still runs, but the pinned tier is now full, so the spare room it spends has fallen to almost nothing and more governing items arrive as a title than before it was built.
summary_of: e4122ae553a5793e
summary_was:
  - "2026-09-11 The premise was wrong: the pinned tier is not half empty, so there is no spare capacity for governing items to use."
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 9bd87de0c35880ef
plan: budget
seq: "16"
state: done
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

CLOSED 2026-09-11. THE BUILD LANDED 2026-09-07 AND THIS ITEM NEVER SAID SO — the SPARE BAND
in `src/core/select.ts` is this ruling, it is documented at the site, and it fires on every
session start. Only the bookkeeping was open. It was found by re-measuring rather than by
reading the state field, which is the way this kind of drift is always found.

AND THE ROOM IT WON HAS SINCE BEEN CONSUMED, BY PINNING. Re-measured with the product’s own
instrument on 2026-09-11, against this project’s own recorded figure from the day it shipped:
the `always` set went 37 → 39 items but 22,582 → 29,016 tokens, so the spare band went
7,418 → 947 and the governing items it admits went 13 → 3. `governingSpill.titled` — the
disclosure this item names as the measurement — rose 69 → 79, within three of the 82 it
stood at before any of this existed.

THE MECHANISM IS NOT BROKEN AND THAT IS THE POINT. `pinnedSpill` is null, every `always` item
is delivered in full, precedence holds. It simply has nothing left to spend. Ten pins are 54%
of the tier and the largest is the D map at 5,839 tokens, a fifth of every session start — a
fact about the budget, not an argument for unpinning an item the owner pinned by ruling.

THE STOPGAP IS NOT TAKEN, ON THIS ITEM’S OWN REASONING. It asks that what is still not
reached be pinned if a gap remains, while warning that once admission is fixed pinning is
"not merely unnecessary but harmful". The band is DEFINED as what `always` did not use, so
every further pin shrinks it one for one: pinning to fix a titled count would shrink the
mechanism that reduces it. Nothing was pinned, unpinned, or written to config.

WHAT IS LEFT IS THE OWNER’S AND IS NOT A TASK: raise `budgets.pinned` (45,543 delivers every
titled governing item in full), unpin something, or accept 79 titled — which are NAMED rather
than silently degraded, so an agent that needs one fetches it by id. The full measurement,
including the ten-most-expensive table, is `reports/2026-09-11-pinned-spare-band-remeasured.md`.

## Relations
- supersedes [[OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items]]
