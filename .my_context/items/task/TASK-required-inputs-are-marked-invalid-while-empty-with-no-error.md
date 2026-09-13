---
id: TASK-required-inputs-are-marked-invalid-while-empty-with-no-error
type: task
title: required inputs are marked invalid while empty, with no error message association and nothing announced
status: active
severity: soft
always: false
summary: Fields are flagged as wrong before anyone has typed in them, and the message explaining what is missing is never announced.
summary_of: efa9b4e0ce7f248b
scope:
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - forms
  - aria
  - "plan:walk"
  - "seq:168"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7aa2a799d17b339e
plan: walk
seq: "168"
state: todo
priority: "3"
---

# required inputs are marked invalid while empty, with no error message association and nothing announced

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 3.7) as row 97 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The Composer's required inputs carry `aria-invalid="true"` WHILE STILL EMPTY, with no `aria-errormessage` pointing at anything. And "Required inputs are missing" is a plain `<p>` with no `role="status"`, so it is never announced -- not when it appears, and not when it clears.

WHY IT IS UNDER D50. The surface exists and is well intentioned: there IS a message, it IS accurate, and the invalid state IS marked. What is missing is the wiring that makes any of it reach the user it was built for. A field marked invalid before it has been touched, with no message associated, is noise rather than help.
