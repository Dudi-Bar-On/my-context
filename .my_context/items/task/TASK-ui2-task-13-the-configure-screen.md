---
id: TASK-ui2-task-13-the-configure-screen
type: task
title: "ui2 task 13: The Configure screen"
status: active
severity: soft
always: false
summary: The screen showing the current settings and what changing one of them would do.
summary_of: 28fbea37e1c4decf
scope: []
tags:
  - "plan:ui2"
  - "seq:13"
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
checksum: 1c43fcb5a198bc7e
plan: ui2
seq: "13"
state: todo
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md#task-13"
last_change: "2026-08-20T00:00:00Z"
priority: "3"
---

# ui2 task 13: The Configure screen

The Configure screen

Task 13 of the ui2 plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md at line 3047 — that file is the authority, and this item tracks state only.

**Reconciliation against the visual repaint, 2026-08-21 (repaint plan Task 13) — REWRITTEN.** The delta rows and segbar blast-radius border colour named in the mockup binding are already recorded elsewhere in this task as not buildable as written, so there is no tint/border code to retarget yet. What Step 1 does implement — a hard-stop parse/resolve/refused error versus an advisory dropped-finding/injectableNowhere/agentEdits-loosened notice — reused one class (.gap/.spill) for both severities, which collapse onto the same --crit hue under ui1 Task 16's reconciliation. Corrected: hard stops take .chip.crit, advisories take .chip.gold. See docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md Task 13 for the corrected text.

VERIFIED NOT DONE 2026-08-26. The screen file exists and is registered (`app.js` · `config: () => import('/screens/config.js'),` · ~205) and that is the whole of what is true. src/ui/public/lib/config-edit.js DOES NOT EXIST, and buildCandidate / changedPaths / renderConfigJson return ZERO HITS repo-wide. `config.js` · `config = await ctx.api('/api/config');` · ~1179 reads GET /api/config and nothing else; POST /api/config/check and /api/config/preview are registered server-side (`read-model-config.ts` · `registerRoute('POST', '/api/config/check', {` · ~406 and `read-model-config.ts` · `registerRoute('POST', '/api/config/preview', {` · ~409) and NEVER CALLED - the screen s own test asserts this at config-screen.test.ts:256, "reads one endpoint and binds nothing that writes". Also .chip.gold, which the reconciliation specifies, has no CSS rule at all.
