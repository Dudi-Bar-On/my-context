---
id: TASK-tree-parity-compare-the-element-tree-not-a-sorted-set-of
type: task
title: "TREE parity: compare the element tree, not a sorted set of kinds"
status: active
severity: soft
always: false
summary: The comparison only checks which kinds of thing appear, ignoring order, nesting and quantity; compare the actual structure instead.
summary_of: 8876b0786435356d
scope: []
tags:
  - "plan:port"
  - "seq:95"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 5925b128a712408d
state: done
plan: port
seq: "95"
---

# TREE parity: compare the element tree, not a sorted set of kinds

OWNER RULING 2026-08-23: "i have requested 1:1 but you have ignored my request". Correct, and the gates are why nobody noticed.

WHAT `screen-parity` ACTUALLY COMPARES, measured by reading it: each screen is flattened to a SORTED SET of element KINDS (`tag.class1.class2`). That set is invisible to four things a person sees immediately - ORDER, NESTING, QUANTITY and CONTENT. A screen drawing one `.blk` passes identically to one drawing twelve. A screen putting a table beside a card passes identically to one nesting it inside. This is why the injection preview can look nothing like its mockup section while every gate is green.

AND FOR EIGHT SCREENS IT IS WEAKER STILL. `DATA_DEPENDENT` - ask, watch, decay, simulate, coverage, graph, proc, capture - makes parity a CEILING, so drawing FEWER kinds than the mockup also passes.

DO: compare the TREE. Tag, classes, order among siblings, depth, and count - per screen, against the mockup section. Report every divergence with a path a person can find (`section > div.card:nth-child(2) > table`), because a diff nobody can locate is a diff nobody fixes.

THIS TASK ENDS AT THE INVENTORY, NOT AT GREEN. Owner ruling: the full list is produced and reviewed BEFORE any screen is changed, so the true size of the gap is the owner's to see and the fix order is the owner's to set. Marking divergences as known is the next task, not this one.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: DONE. It ended where it said it would end -- at the inventory, reviewed, not at green.

WHAT WAS BUILT: e2e/tree-walk.ts and e2e/tree-parity.spec.ts compare tag, classes, order among siblings, depth and count per screen, and report every divergence with a locatable path -- step(node) = sibs>1 ? kind:nth-child(idx) : kind, which is the "a diff nobody can locate is a diff nobody fixes" requirement met literally.

WHAT WAS DELIVERED TO THE OWNER, which is the part that actually closes this task: the full list, rendered side by side from real captured markup and real stylesheets, every divergence outlined in place, at C:\Users\UserC\Desktop\tree-parity-inventory\inventory.html. Walked with the owner screen by screen, 2026-08-24 and 2026-08-25. Measured three times against the same fixture: 182 -> 197 -> 164 divergences, 97 -> 106 -> 77 structural.

THE OWNER SET THE FIX ORDER, which was the ruling this task was written to protect: worst-missing first, by NODE DEFICIT rather than by finding count -- because the walker reports an absent CONTAINER once and does not recurse, so simulate s whole simulator card arrived as one ambiguous line.

AND IT UNBLOCKS THINGS NOBODY WENT BACK TO. At least plan:ui2 seq:5r and plan:port seq:94 name this task as their blocker. Both are unblocked now.
