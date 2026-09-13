---
id: TASK-reflow-at-320-css-px-leaves-the-content-column-106-px-and
type: task
title: reflow at 320 CSS px leaves the content column 106 px and pushes 2318 text elements off an unscrollable page
status: active
severity: soft
always: false
summary: At high zoom the navigation keeps most of the width, the content is squeezed into a sliver, and thousands of words end up off-screen with no way to scroll to them.
summary_of: 5af8f530e09799d5
scope:
  - src/ui/public/styles.css
tags:
  - v2
  - ui
  - wcag
  - reflow
  - "plan:wcag"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 3b5678c9dc107b89
plan: wcag
seq: "2"
state: todo
priority: "2"
---

# reflow at 320 CSS px leaves the content column 106 px and pushes 2318 text elements off an unscrollable page

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`) as row 22 of `reports/2026-09-13-the-consolidated-findings.md`. Report 1 listed reflow UNASSESSED and guessed it would fail; report 2 measured it.

WHAT WAS MEASURED. WCAG 1.4.10 Reflow fails at 320 CSS px, which is 400% zoom on a 1280 px display. The rail keeps 214 px of the 320; `<main>` is left with 106 px; 2318 text elements are pushed off the right edge; and the page does NOT scroll horizontally, so none of them can be reached.

THE CAUSE, and it is small enough to state exactly. The entire responsive design is THREE media queries, all of them `grid-template-columns: 1fr`.

WHY IT IS UNDER THIS SUBJECT. This is a named success criterion with a defined test, failed on a measurement rather than an opinion. The subject exists so conformance is stated as a measurement and not assumed from a tool score -- the Lighthouse accessibility 100 this product earned cannot see this at all.
