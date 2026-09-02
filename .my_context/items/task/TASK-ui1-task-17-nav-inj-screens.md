---
id: TASK-ui1-task-17-nav-inj-screens
type: task
title: "ui1 task 17: nav.inj screens"
status: active
severity: soft
always: false
summary: "The three screens about what a session is given: what fits, what would fit under other limits, and what was actually delivered."
summary_of: 07e604941e269304
scope: []
tags:
  - "plan:ui1"
  - "seq:17"
  - "state:done"
  - v2
  - ui
  - "reconcile:rewritten"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 4ed118114c11a9cd
plan: ui1
seq: "17"
state: done
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md#task-17"
last_change: "2026-08-20T00:00:00Z"
priority: "3"
---

# ui1 task 17: nav.inj screens

Task 17 of the ui1 plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md at line 5709 - that file is the authority, and this item tracks state only.

**Reconciliation against the visual repaint, 2026-08-21 (repaint plan Task 13) - REWRITTEN.** preview.js builds the injection preview, which is the repaint's own hero screen (repaint Task 6) - its composition is now normative for this task: a .pane of .row items linked to a .pane of .lit/.blk, selection dimming siblings. simulate.js and injected.js join repaint Task 9's Injection group. Every number this screen draws (budget bar, spilled list, tier fits) moves onto .plate per repaint Task 7 - data may not float on bare glass.

**Amended 2026-08-22: the dim value is .58, not .42.** Reviewing the rendered hero screen found that opacity dims the block's TEXT along with its presence, and .42 over the plate measures ~3.6:1 against the 4.5:1 body-text floor this direction holds everywhere else. .58 measures ~5.1:1. The ruling behind the number - far enough to recede, not so far that two items cannot be compared - is unchanged. e2e/injection-preview.spec.ts pins 0.58 and its header carries the reason.

See docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md Task 17 for the corrected text.
