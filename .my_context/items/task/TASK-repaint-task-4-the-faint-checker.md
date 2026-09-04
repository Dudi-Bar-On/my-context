---
id: TASK-repaint-task-4-the-faint-checker
type: task
title: "repaint task 4: the --faint checker"
status: active
severity: soft
always: false
summary: Automatically enforce that the faintest text colour is used only at sizes where it stays readable, rather than trusting people to remember.
summary_of: fb1f535235b66d93
scope: []
tags:
  - "plan:repaint"
  - "seq:4"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 735d643e9c1e685b
plan: repaint
seq: "4"
state: done
priority: "1"
source: "my-context/docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md#task-4"
---

# repaint task 4: the --faint checker

The token --faint measures 3.83 and is legal only at large-text size. The rule is ENFORCED rather than remembered, because rules people are asked to remember are the ones this project keeps finding broken. The checker must be made to fail on a deliberate violation before it is trusted.

Task 4 of the web UI visual repaint. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md at line 292 - that file is the authority, and this item tracks state only.

The direction it implements is my-context/docs/superpowers/specs/2026-08-21-web-ui-visual-direction-design.md, approved section by section by the owner on 2026-08-21.
