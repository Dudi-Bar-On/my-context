---
id: TASK-forced-colors-is-entirely-unsupported-on-a-palette-built
type: task
title: forced-colors is entirely unsupported, on a palette built from custom properties High Contrast cannot override
status: active
severity: soft
always: false
summary: The platform's own high-contrast mode has no effect on this tool, because the colours are defined in a way that mode cannot replace.
summary_of: fdc59428c5071013
scope:
  - src/ui/public/styles.css
tags:
  - v2
  - ui
  - wcag
  - forced-colors
  - "plan:wcag"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5794933ca2600b8e
plan: wcag
seq: "6"
state: todo
priority: "3"
---

# forced-colors is entirely unsupported, on a palette built from custom properties High Contrast cannot override

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`, 3.5) as row 100 of `reports/2026-09-13-the-consolidated-findings.md`. Report 1 listed this UNASSESSED; report 2 measured it.

WHAT WAS MEASURED. `forced-colors` is ENTIRELY UNSUPPORTED: 810 CSS rules, ZERO `@media (forced-colors: ...)` blocks and ZERO `prefers-contrast` blocks.

WHY IT MATTERS HERE SPECIFICALLY. The owner runs Windows 11, where High Contrast is the platform's own accessibility mode -- and THE PALETTE IS BUILT ON CUSTOM PROPERTIES, WHICH HIGH CONTRAST DOES NOT OVERRIDE. So turning the platform feature on does not make this product high-contrast; it makes it unpredictable.

THE SUBJECT. This is conformance that has to be measured on the platform the user is on, and it is invisible to every automated score the product currently holds.
