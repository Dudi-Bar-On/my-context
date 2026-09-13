---
id: TASK-date-inputs-show-a-browser-locale-placeholder-in-the-hebrew
type: task
title: date inputs show a browser-locale placeholder in the Hebrew UI, and four form fields carry no id or name
status: active
severity: soft
always: false
summary: Date fields show their hint in the wrong language because the browser supplies it, and four fields on the page have no name at all.
summary_of: d0ecf0e950dc2c28
scope:
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - forms
  - i18n
  - "plan:walk"
  - "seq:160"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: dbbf532ef0cca361
plan: walk
seq: "160"
state: todo
priority: "3"
---

# date inputs show a browser-locale placeholder in the Hebrew UI, and four form fields carry no id or name

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`, 4.4 and 3.9) as row 119 of `reports/2026-09-13-the-consolidated-findings.md`. TWO SMALL MEASURED FACTS:

- DATE INPUTS SHOW `dd/mm/yyyy` IN THE HEBREW UI, because a native `<input type="date">` takes its placeholder from the BROWSER LOCALE and not from the page. So it is not a string-table miss -- the string table cannot reach it, and the fix is either a formatted hint beside the field or a custom control.
- ONE CONSOLE ISSUE: "A form field element should have an id or name attribute (count: 4)".

WHY THEY ARE FILED TOGETHER. Both are small, both are on form controls, and both were measured in the same pass. Neither is worth its own address; neither should be dropped.

RELATED: row 97 is the other form-control finding on the same surface, and rows 30 and 105 are the genuine string-table gaps -- this one is deliberately NOT filed as one of those, because the placeholder is not ours to set.
