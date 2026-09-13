---
id: TASK-two-column-cards-do-not-balance-and-the-background-gradient
type: task
title: two-column cards do not balance and the background gradient competes with the content at full chroma
status: active
severity: soft
always: false
summary: One column of a card runs out well before the other, leaving a large empty area where the background is at its strongest.
summary_of: 305142a29e3721f1
scope:
  - src/ui/public/styles.css
tags:
  - v2
  - ui
  - layout
  - gradient
  - "plan:walk"
  - "seq:158"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 343dfc5d5fa80a64
plan: walk
seq: "158"
state: todo
priority: "3"
---

# two-column cards do not balance and the background gradient competes with the content at full chroma

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 4.5 and 4.6) as row 117 of `reports/2026-09-13-the-consolidated-findings.md`. TWO OBSERVATIONS ABOUT THE SAME SURFACE:

- TWO-COLUMN CARDS DO NOT BALANCE. `DELIVERED` ends after about a third of its column while `WHY NOT` continues, leaving a large empty rectangle AT FULL GRADIENT STRENGTH.
- THE BACKGROUND GRADIENT COMPETES WITH THE CONTENT at full chroma across the whole content area.

WHY THEY ARE ONE ITEM. The empty rectangle is only conspicuous because the gradient is at full strength behind it; damping the gradient or balancing the columns each reduces the other. Treating them separately produces two half-fixes.

THE SUBJECT. D44 is the app matched against its design of record, and the gradient's intended strength behind content is a question the design answers.
