---
id: TASK-2052-controls-compute-three-accessible-names-between-them
type: task
title: 2052 controls compute three accessible names between them, with nothing saying which row each acts on
status: active
severity: soft
always: false
summary: Thousands of buttons on one screen announce themselves with the same three labels, so assistive technology cannot tell which row any of them belongs to.
summary_of: 0a90cc8768a9125b
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - wcag
  - accessible-name
  - "plan:wcag"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 3ebd25a711422183
plan: wcag
seq: "4"
state: todo
priority: "2"
---

# 2052 controls compute three accessible names between them, with nothing saying which row each acts on

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`) as row 28 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. 684 rows with three controls each -- 2052 controls in all -- compute the same three accessible names -- `Open the conversation at this point`, `Rename`, `Take it back` -- with no `aria-label` naming WHICH anchor any of them acts on.

THE CONSEQUENCE. A screen-reader user navigating by control cannot tell 2052 controls apart, and one of the three deletes data with no confirm and no undo (row 25).

WHY IT IS UNDER THIS SUBJECT. It is a measurable conformance failure -- controls with the same accessible name and different destinations -- and it is invisible to the automated score the product currently holds.
