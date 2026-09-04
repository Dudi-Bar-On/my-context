---
id: TASK-the-chip-s-base-rule-sets-a-bare-colour-that-two-comments
type: task
title: the chip's base rule sets a bare colour that two comments say it does not
status: active
severity: soft
always: false
summary: A styling detail and the two comments describing it disagree; settle which is right, and what a plain one should look like.
summary_of: e1a3bc81cfce9629
scope: []
tags:
  - "plan:repaint"
  - "seq:3e"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 3c6fb92a5d335a14
plan: repaint
seq: 3e
state: done
priority: "2"
---

# the chip's base rule sets a bare colour that two comments say it does not

Found by the hue-rulings agent and deliberately left, because no ruling authorised touching it.

.chip carries color:#0b0c11 in its base rule, while both its own local comment and the primitives-section comment claim it sets no border and no bare colour. Harmless in practice - the 49 legacy .chip.gov/.ok/.warn/.crit usages win on specificity regardless - and test/ui/primitives.test.ts only machine-checks the absence of a border declaration, never a colour.

Two things to settle: whether the comments should be corrected to match the code, or the code changed to match the comments; and what a bare unmodified .chip should look like when one is actually drawn, which happens for the ribbon's index tier.

Recorded because a comment that describes a property the code does not have is the exact drift this project keeps finding, and here there are two of them agreeing with each other and disagreeing with the file.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS -- and it is THE SAME QUESTION as plan:screens seq:1s-c, which nobody had connected. Two plans, two agents, two days apart, one defect.

THIS TASK asks "what should a bare unmodified .chip look like when one is actually drawn, which happens for the ribbon s index tier".
plan:screens seq:1s-c reports what it looks like: the index tier s chip is INVISIBLE -- near-black label, near-black border, near-black plate -- in the mockup and in the app alike, because TIERCHIP.index is the one entry with no modifier and .chip s base rule sets color:#0b0c11.

So one task holds the QUESTION and the other holds the MEASURED CONSEQUENCE, with a photograph. DISPATCH THEM TOGETHER; either alone gets half an answer.

THE SECOND HALF OF THIS TASK IS SEPARATE AND SMALLER: two comments -- .chip s own local one and the primitives-section one -- both claim the base rule sets no bare colour, and both are wrong. test/ui/primitives.test.ts machine-checks the absence of a BORDER declaration and never a colour, which is why they could stay wrong. Correcting comments is not blocked on the owner; the colour ruling is.
