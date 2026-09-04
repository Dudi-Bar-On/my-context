---
id: TASK-the-chip-s-four-hue-shape-variants-are-unspecified-so-they
type: task
title: the chip's four-hue shape variants are unspecified, so they were left unwired
status: active
severity: soft
always: false
summary: Colour is the only thing separating these small markers; the promised shapes were never named, so name them or drop the idea.
summary_of: f709a3704409baf2
scope: []
tags:
  - "plan:repaint"
  - "seq:3c"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 4bed3217cff4df91
plan: repaint
seq: 3c
state: done
priority: "1"
---

# the chip's four-hue shape variants are unspecified, so they were left unwired

Spec section 3 item 6 requires a chip variant system carrying four hues and three shapes - circle, square, diamond - so that colour is not the only channel. Neither the spec nor the repaint plan names the selectors for it.

The primitives agent shipped .chip as a base rule that deliberately sets no border and no bare colour, so it cannot shadow the 49 pre-existing .chip.gov/.ok/.warn/.crit usages, and left the variant system genuinely unwired rather than inventing selector names that twenty screens would then copy.

That was the right call and it leaves a decision: name the variants, or rule that the shape channel is dropped. Task 6 composes chips into the hero screen, so it is the first place the absence will show.
