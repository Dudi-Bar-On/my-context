---
id: LESSON-two-byte-identical-rules-in-the-opposite-order-resolve
type: lesson
title: two byte-identical rules in the opposite order resolve differently
status: active
severity: soft
always: false
summary: Two identical styling rules can behave differently depending on which is written last, so comparing text without order proves nothing.
summary_of: 8ecae7812e0bf219
scope: []
tags:
  - v2
  - ui
  - gate
  - measurement
  - css
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 2d6ddf95cc715c3a
---

# two byte-identical rules in the opposite order resolve differently

Found 2026-08-25, fixing the activity pulse.

The pulse SVG rendered 36.375px tall inside an 8px plate -- overflowing a box that clips it and losing its tallest columns. The SVG was fine. The CSS was fine. Both rules were BYTE-IDENTICAL to the design of record s.

  mockup   svg.chart   ~763   block-size:auto
           .pulse svg  ~870   block-size:100%   <- last, wins, svg is 8px

  app      .pulse svg   747   block-size:100%
           svg.chart   1001   block-size:auto   <- last, wins, svg sizes by
                                                   its 900:34 aspect ratio

Both selectors are specificity (0,1,1), and a `<svg class="chart">` inside `.pulse` matches both. Equal specificity means SOURCE ORDER decides, and the two files declare the pair in opposite order -- the app grouping the rule with its `.pulse` component, the mockup with its charts.

The arithmetic is exact and worth keeping: the plate is 963px wide, so an SVG sizing itself by aspect ratio is 963 x 34/900 = 36.4px. The number in the failure message was the aspect ratio, not a random overflow.

THE GENERAL FORM: byte-identity of a rule is not identity of its EFFECT. A stylesheet is an ordered document, and a gate that compares the blocks without comparing the sequence is checking the words and not the sentence. `styles-parity` was green throughout.

A first screen for this found 111 candidate pairs -- equal specificity, shared property, opposite order -- and that number is NOT a defect count and must not be quoted as one. It never asks whether any ELEMENT matches both selectors, and most of those pairs never meet. Getting the true number needs a DOM, which is what the gate task exists to build.
