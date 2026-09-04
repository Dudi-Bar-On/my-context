---
id: TASK-styles-parity-must-compare-what-the-cascade-resolves-to-not
type: task
title: styles-parity must compare what the cascade RESOLVES to, not just the blocks
status: active
severity: soft
always: false
summary: The styling check compares rules but not their order, so two identical files can still draw differently; make it check what actually wins.
summary_of: 6d810a2103d8168b
scope: []
tags:
  - v2
  - ui
  - gate
  - css
  - measurement
  - "plan:walk"
  - "seq:15"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: b1f56e3d2b5ee2c5
plan: walk
seq: "15"
state: todo
priority: "2"
source: "plan:walk seq:9"
---

# styles-parity must compare what the cascade RESOLVES to, not just the blocks

THE DEFECT IT MISSED, in full, because the shape matters more than the instance: the activity pulse overflowed its plate by 28px for weeks while every rule involved was byte-identical to the design of record. `.pulse svg` and `svg.chart` are both specificity (0,1,1); an svg.chart inside .pulse matches both; the two files declare them in OPPOSITE ORDER; so the same two rules resolved to `block-size:100%` in the mockup and `block-size:auto` in the app. The gate compares blocks and not their sequence.

WHAT THE CHECK MUST DO, and the second half is the hard and necessary half:
1. Find pairs of rules that share a declared property and have EQUAL specificity, where the two files order them differently.
2. Keep only the pairs where SOME ELEMENT ACTUALLY MATCHES BOTH SELECTORS. This needs a real DOM -- the 21 rendered screens -- and not a string heuristic.

STEP 2 IS NOT OPTIONAL AND HERE IS THE EVIDENCE. A first screen doing only step 1 reported 111 pairs. `.banner` and `.cnt` are in it, both declaring `color`, and no element carries both classes; they will never collide. Shipping that number as a defect count would be the same failure this whole review has been about -- a measurement reported as a finding.

THE FIX FOR AN INSTANCE IS ORDER, NOT SPECIFICITY. Raising `.pulse svg` to `.pulse svg.chart` would win regardless of order and would ALSO break styles-parity s byte-identity with the mockup, which is a gate worth keeping. Move the rule instead, and leave a comment saying why it is not with its component -- this fix already did, because the next person to tidy it back would restore the defect.
