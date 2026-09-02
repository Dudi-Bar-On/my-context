---
id: TASK-ui1-task-18-scope-coverage-with-detail-pane-and-print-mode
type: task
title: "ui1 task 18: Scope coverage with detail pane and print mode; coverage gaps; relations"
status: active
severity: soft
always: false
summary: The screens showing which parts of the project are covered, which are not, and how things relate to one another.
summary_of: fc0acfb57df736ac
scope: []
tags:
  - "plan:ui1"
  - "seq:18"
  - "state:todo"
  - v2
  - ui
  - "reconcile:rewritten"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 9c5ca83b63bd9835
plan: ui1
seq: "18"
state: todo
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md#task-18"
last_change: "2026-08-20T00:00:00Z"
priority: "3"
---

# ui1 task 18: Scope coverage with detail pane and print mode; coverage gaps; relations

Scope coverage with detail pane and print mode; coverage gaps; relations

Task 18 of the ui1 plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md at line 5990 — that file is the authority, and this item tracks state only.

**Reconciliation against the visual repaint, 2026-08-21 (repaint plan Task 13) — REWRITTEN.** The coverage tree and detail panel move onto `.pane`/`.plate` (repaint Task 7 — data may not float on bare glass). The relations ego graph hardcoded two hex colours (`#a01a1a` dangling edge/missing node, `#888` normal edge) drawn from a placeholder token that no longer exists; both are now CSS classes (`.edge`, `.edge-dangling`) backed by `--pane-edge`/`--crit` so forced-colors (repaint Task 11) can restate them. The print button's own trigger is unaffected, but what it prints is not — repaint Task 10 designs a dedicated print register since dark glass has no light theme to fall back on. See docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md Task 18 for the corrected text.

VERIFIED PARTIAL 2026-08-26. Met: the coverage tree and detail pane both sit on `.pane` (`coverage.js` · `const treeCard = el('div', 'card pane');` · ~284 and `coverage.js` · `const detCard = el('div', 'card pane');` · ~314), the gaps screen exists, and the relations graph uses classes rather than hex. NOT MET: PRINT MODE WAS NEVER CARRIED. `styles.css` · ``No `@media print` here`` · ~54 states in as many words "No @media print here"; the only real @media print block lives in the mockup (`web-ui-mockup.html` · `@media print{` · ~1227). `coverage.js` · `The plan's sketch adds one on` · ~75 declines to draw the print button, deferring to a stylesheet register that does not exist, and e2e/print.spec.ts tests the MOCKUP only - nothing tests the product print output.
