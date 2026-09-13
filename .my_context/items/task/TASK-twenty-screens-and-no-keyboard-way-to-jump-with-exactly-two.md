---
id: TASK-twenty-screens-and-no-keyboard-way-to-jump-with-exactly-two
type: task
title: twenty screens and no keyboard way to jump, with exactly two key listeners in the app
status: active
severity: soft
always: false
summary: There are twenty screens and no keyboard shortcut to reach any of them, although the list of screens is already structured data.
summary_of: f8c309f4bee77455
scope:
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - keyboard
  - navigation
  - "plan:walk"
  - "seq:157"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5d6e6b10bb9bc477
plan: walk
seq: "157"
state: todo
priority: "3"
---

# twenty screens and no keyboard way to jump, with exactly two key listeners in the app

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 1.3) as row 95 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Twenty screens and no way to jump between them from the keyboard. There are EXACTLY TWO `keydown` listeners in the entire app and both of them handle `Escape`.

AND THE DATA IS ALREADY THERE. The screen list is declarative -- each entry carries `data-s` -- so the mapping a shortcut would need already exists and is already used for rendering.

RELATED: row 23 measures what this costs today -- the first control inside the content area is tab stop 23 or 24 of 77, and every screen change starts that walk again.
