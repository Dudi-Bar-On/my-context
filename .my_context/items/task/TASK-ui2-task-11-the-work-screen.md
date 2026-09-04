---
id: TASK-ui2-task-11-the-work-screen
type: task
title: "ui2 task 11: The Work screen"
status: active
severity: soft
always: false
summary: The screen showing proposed changes that are waiting on a person, field by field.
summary_of: f409a602124b9db7
scope: []
tags:
  - "plan:ui2"
  - "seq:11"
  - v2
  - ui
  - "reconcile:rewritten"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 1cc937317bccdfec
plan: ui2
seq: "11"
state: todo
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md#task-11"
last_change: "2026-08-20T00:00:00Z"
priority: "3"
---

# ui2 task 11: The Work screen

The Work screen

Task 11 of the ui2 plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md at line 2421 — that file is the authority, and this item tracks state only.

**Reconciliation against the visual repaint, 2026-08-21 (repaint plan Task 13) — REWRITTEN.** The per-field diff reused two retired utility classes (.gap for removed lines, .spill for added lines and for the stale-field/item-missing/force-promote warnings) that both collapse onto --crit under ui1 Task 16's reconciliation, losing the diff's own -/+ contrast. Corrected: removed lines take --crit, added lines take --ok, and the stale-field/item-missing/force-promote warnings take --gold (a notice, not a hard failure). The diff itself now sits on .plate (repaint Task 7) inside the revision card's .pane. See docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md Task 11 for the corrected text.

VERIFIED PARTIAL 2026-08-26, and this is the most consequential of the eight. Met: work.js exists (468 lines), is registered at `app.js` · `work: () => import('/screens/work.js'),` · ~203, has a test, and GET /api/revisions is registered at `read-model-work.ts` · `registerRoute('GET', '/api/revisions', json(apiRevisions));` · ~354. NOT MET, three ways: (a) the plan s Interfaces name GET /api/review-queue and this screen never calls it - `work.js` · `not read by this screen at all` · ~94 says so itself, "not read by this screen at all" - so the DRAFT-QUEUE HALF is unbuilt; (b) THIS TASK IS THE PRODUCER OF `writeBlock`, which ui2/12 and ui2/13 both declare they consume, AND NO writeBlock SYMBOL EXISTS ANYWHERE IN src/; (c) the rewritten reconciliation s own corrections are absent - no diffBlock, no .plate pre, and `work.js` · `const chip = el('span', 'chip warn', 'stale');` · ~338 still draws el("span","chip warn","stale").
