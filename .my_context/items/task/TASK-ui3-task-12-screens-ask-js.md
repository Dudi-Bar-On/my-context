---
id: TASK-ui3-task-12-screens-ask-js
type: task
title: "ui3 task 12: screens/ask.js"
status: active
severity: soft
always: false
summary: The screen for building a question about the project, which also shows the query it ran.
summary_of: d3e2d3932955d68e
scope: []
tags:
  - "plan:ui3"
  - "seq:12"
  - v2
  - ui
  - "reconcile:rewritten"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 6db2d296ddca3111
plan: ui3
seq: "12"
state: done
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md#task-12"
last_change: "2026-08-20T00:00:00Z"
priority: "3"
---

# ui3 task 12: screens/ask.js

screens/ask.js — the query builder

Task 12 of the ui3 plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md at line 3795 — that file is the authority, and this item tracks state only.

**Reconciliation against the visual repaint, 2026-08-21 (repaint plan Task 13) — REWRITTEN.** The result table's "role as a chip" is named in the mockup binding but not implemented in this task's own renderRows; when built it is the .chip primitive with a meaning hue, not invented here. The executed-SQL pane is data (the screen's whole point, so it teaches) and moves onto .plate (repaint Task 7), which drops the old ask-sql border and the retired --line token it used. See docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md Task 12 for the corrected text.
