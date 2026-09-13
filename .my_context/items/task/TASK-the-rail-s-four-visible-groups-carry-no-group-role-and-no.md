---
id: TASK-the-rail-s-four-visible-groups-carry-no-group-role-and-no
type: task
title: the rail's four visible groups carry no group role and no label, so assistive tech gets twenty flat buttons
status: active
severity: soft
always: false
summary: The navigation is visibly organised into four groups and none of that structure is expressed in anything a screen reader can use.
summary_of: 39525c5244c25755
scope:
  - src/ui/public/screens/parts.js
  - src/ui/public/index.html
tags:
  - v2
  - ui
  - wcag
  - landmarks
  - "plan:wcag"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5ad0f0b8e655b05a
plan: wcag
seq: "5"
state: todo
priority: "3"
---

# the rail's four visible groups carry no group role and no label, so assistive tech gets twenty flat buttons

FOUND BY BOTH UI REVIEWS and confirmed unchanged between them. Row 89 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The rail's four groups are `<div class="grp">` headed by a bare `<p>`, with no `role="group"` and no `aria-labelledby`. To a screen reader the navigation is TWENTY FLAT BUTTONS with no structure at all.

WHY IT IS UNDER THIS SUBJECT. The grouping is visible, deliberate and meaningful to a sighted user; it is simply not expressed in anything assistive technology reads. That is a conformance gap that has to be measured -- the automated score the product holds cannot see it, and neither can a visual review.

RELATED: row 23 records that a keyboard user walks this whole rail before reaching any content, which is what makes its structure worth expressing.
