---
id: TASK-ui3-task-11-screens-watch-js-and-window-myctx-stream
type: task
title: "ui3 task 11: screens/watch.js and window.myctx.stream()"
status: active
severity: soft
always: false
summary: The activity screen, and the live feed of events that fills it.
summary_of: 1bf247bdf2c15828
acknowledged:
  - citation_form@df61d9829fb618fe
scope: []
tags:
  - "plan:ui3"
  - "seq:11"
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
checksum: b1f50da05ca6fc43
plan: ui3
seq: "11"
state: done
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md#task-11"
last_change: "2026-08-20T00:00:00Z"
priority: "3"
---

# ui3 task 11: screens/watch.js and window.myctx.stream()

screens/watch.js and window.myctx.stream() — the Watch screen

Task 11 of the ui3 plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md at line 3429 — that file is the authority, and this item tracks state only.

**Reconciliation against the visual repaint, 2026-08-21 (repaint plan Task 13) — REWRITTEN.** The status strip is chrome carrying git info (matching the new .hdr primitive's description) drawn as a bordered plain div with the retired --line token; primitive 1 rules nothing in the product is a plain box, so it becomes .pane. .strip-spark and .rec-kind key off the retired ui1-Task16 placeholder token --accent and retarget to --dim. The six-colour-by-kind scheme this task cites from AUDIT_KINDS has no clean mapping onto the new four-hue budget and is not actually implemented in this task's code either way; the real ruling is deferred to whoever builds #pulse. See docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md Task 11 for the corrected text.

VERIFIED PARTIAL 2026-08-26. Met, and substantially: watch.js is 817 lines, registered at `app.js` · `watch: () => import('/screens/watch.js'),` · ~192; `stream` is exported on window.myctx (`app.js` · `window.myctx = {` · ~6662, implementation :681); GET /api/watch/stream is registered (`watch-model.ts` · `registerRoute('GET', '/api/watch/stream', { kind: 'stream', handle: streamHandler });` · ~963) along with volume, context, spills and ratio; the pulse carries per-kind hues and the regime rule. NOT MET: THERE IS NO SCREEN-LEVEL TEST. test/ui/ holds watch-model.test.ts and watch-e2e.test.ts, both at endpoint level, and no watch-screen.test.ts counterpart to the four screens that have one.

CITATION DRIFT, checked 2026-09-03. `stream` is no longer on the `window.myctx` contract: screens call `subscribeStream` and the shell holds one connection (`app.js` · `subscribeStream,` · ~6682, and `app.js` · `reachable from a screen at all (removed from the` · ~1828). The citation names the contract object, which is what the sentence is about; the "`stream` is exported on it" half is out of date.
