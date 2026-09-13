---
id: TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and
type: task
title: 684 anchors render unpaged as 92 percent of the document and the filter costs over a second per keystroke
status: active
severity: soft
always: false
summary: One list draws every row at once, which makes it most of the page and makes typing in its filter take more than a second per letter.
summary_of: 2620a0d120d79b1b
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - performance
  - bounded-list
  - "plan:confirm"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 4a5abd3dd09f08c5
plan: confirm
seq: "3"
state: todo
priority: "2"
---

# 684 anchors render unpaged as 92 percent of the document and the filter costs over a second per keystroke

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`) as row 27 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. 684 anchors render unpaged: 11,996 DOM nodes, 92% of the whole document. There is no paging control. Filtering the list costs 1,097-2,017 ms PER KEYSTROKE, against Google's 200 ms "poor" threshold. Identical labels repeat nine times within the first twelve rows.

WHY IT IS A DEFECT AND NOT A SCALE PROBLEM. This product has a bounded-list pattern that every other list in it holds, and both UI reviews singled that pattern out as one of the best things in the product -- "Showing the first 20 of 36 ... All 36 were in the injection, none were dropped." Report 2's words: the anchors list is the first list in the product to break it, which is itself evidence of how consistently the rest holds.

RELATED: row 102 of the same table records that filtering this list then HIDES the total, reading "1 marked." where every other list says "the first N of M".
