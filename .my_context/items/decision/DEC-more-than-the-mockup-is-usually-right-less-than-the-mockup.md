---
id: DEC-more-than-the-mockup-is-usually-right-less-than-the-mockup
type: decision
title: more than the mockup is usually right; less than the mockup is the gap
status: active
severity: soft
always: false
summary: Where the working product does more than the old drawing, the product is presumed right; where it does less, that is the gap to close.
summary_of: 335ecce64023d820
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - tree-parity
  - mockup
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 3a2af4a54e8de797
---

# more than the mockup is usually right; less than the mockup is the gap

OWNER RULING, 2026-08-24, taken while choosing the order to walk the screens in.

The mockup was drawn at a point in time and development did not stop there. Where a screen now draws MORE than the design of record, that surplus is in most cases CODE THAT IMPLEMENTS SOMETHING REAL, built after the drawing. Where it draws LESS, that is the gap.

SO THE TWO DIRECTIONS ARE NOT SYMMETRIC, and nothing may treat them as if they were:
- app draws LESS  -> a defect, and the work is to build what is missing.
- app draws MORE  -> presumed correct. The reconciliation goes INTO THE MOCKUP, and the surplus is deleted only when someone shows it is wrong.

WHY THIS IS NOT A RETREAT FROM 1:1. RULE-1-1-with-the-mockup still governs, and this says what 1:1 MEANS when the two disagree in the app s favour: they are made to agree, and the direction is decided by which one is right rather than by which one is older. The .cmd ruling taken on proc the same day is the first worked example -- the app was right, and the mockup is the thing being changed.

WHAT WOULD REOPEN THIS: a surplus that nobody can name a reason for. Extra nodes with no feature behind them are drift, not development, and this ruling is not a licence to stop asking which one a surplus is.

Measured the same day: proc draws 132 nodes to the mockup s 91, coverage 275 to 116, docs 106 to 47. Those three were being read as the worst screens on the board; under this ruling they are the ones furthest AHEAD.
