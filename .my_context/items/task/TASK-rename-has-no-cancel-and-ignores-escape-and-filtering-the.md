---
id: TASK-rename-has-no-cancel-and-ignores-escape-and-filtering-the
type: task
title: rename has no cancel and ignores Escape, and filtering the list hides the total
status: active
severity: soft
always: false
summary: Once a rename box is open the only way out is to save, and filtering the list stops telling you how many entries there were.
summary_of: 9a804b586b727e4f
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - write-flow
  - escape
  - "plan:confirm"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5edaceb1b48fcf87
plan: confirm
seq: "5"
state: done
priority: "3"
---

# rename has no cancel and ignores Escape, and filtering the list hides the total

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`, 2.5 and 2.9) as row 102 of `reports/2026-09-13-the-consolidated-findings.md`. TWO DEFECTS IN ONE WRITE FLOW:

- RENAME HAS NO CANCEL AND IGNORES ESCAPE. The only way out of a rename editor is to save one. There is no route back from a rename a user opened by mistake.
- FILTERING THE ANCHOR LIST HIDES THE TOTAL, reading `1 marked.` where every other list in the product says "the first N OF M". Both UI reviews named that bounded-list honesty one of the best things in the product; this is the second place that breaks it, the first being row 48.

THE SUBJECT. A write flow has to say what it did and leave a way out. This one traps the user in an editor and then hides the size of what they were filtering.
