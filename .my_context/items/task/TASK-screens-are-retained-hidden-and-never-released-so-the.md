---
id: TASK-screens-are-retained-hidden-and-never-released-so-the
type: task
title: screens are retained hidden and never released, so the document only grows across a session
status: active
severity: soft
always: false
summary: Every screen you visit stays in memory for the rest of the session, so the page keeps growing the longer it is used.
summary_of: bbb39d8a9820779d
scope:
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - memory
  - "plan:walk"
  - "seq:154"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: adf362367a766351
plan: walk
seq: "154"
state: todo
priority: "3"
---

# screens are retained hidden and never released, so the document only grows across a session

FOUND BY BOTH UI REVIEWS, measured two different ways. Row 92 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The DOM only grows -- screens are retained with `hidden` and never released. Report 1 measured 3,124 to 35,028 nodes over one session. Report 2 measured Conversations alone holding 12,124 of 13,025 nodes.

AND THE HALF THAT IS ALREADY CORRECT, recorded so it is not re-litigated: `hidden` DOES keep those nodes out of the tab order and out of the accessibility tree. So this is a memory and layout-cost finding, not an accessibility one.

RELATED: row 27 is why Conversations is 12,124 of those nodes, and row 93 is why the growth is thrown away on a language switch rather than reused.
