---
id: TASK-the-conversation-document-still-writes-the-look-tick-by-hand
type: task
title: the conversation document still writes the look-tick by hand, one floor below the module that now owns it
status: active
severity: soft
always: false
summary: Two screens each carry their own copy of the rule that refreshes a page the moment you look back at the tab, and one of them should simply use the other's.
summary_of: fcbffdc60eb1ca56
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/lib/heartbeat.js
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:29"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/archive29.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 99b448a47535100f
plan: archive
seq: "29"
state: done
priority: "3"
verified_on: 2026-09-10
---

# the conversation document still writes the look-tick by hand, one floor below the module that now owns it

DONE 2026-09-10, and the item's own prescription was corrected by measurement rather than followed.

WHAT SHIPPED. `attachLook` in `src/ui/public/lib/heartbeat.js` is exported, and `screens/conversations.js` now takes THREE things from that module instead of one: `shouldPing` (as before), `attachLook` (the `visibilitychange`/`focus` pair, registered together and removed through the single handle it returns), and `LOOK_GAP_MS`. The local `const LOOK_GAP_MS = 250` is gone and neither event name is spelled in the screen any more - four hand-written lines and one re-chosen number, removed. `stopFollowing` calls `detachLook()`; a copy or a truncated document registers nothing, so the handle starts as a no-op.

WHAT THE ITEM ASKED FOR AND WHY IT IS WRONG. The item names `startHeartbeat(document, tick, TIP_MS, window)` as the adoption. It cannot be, and the reason is an ORDER: `beat` asks `shouldPing` BEFORE calling `pingFn`, while this screen's `tick` asks `scroll.isConnected` FIRST and tears the whole follow down when the answer is no. Under `startHeartbeat` a hidden tab whose document well had been replaced would never reach that teardown, so the timer and both listeners would outlive the well - the per-conversation leak `stopFollowing`'s own comment is about. `startLookTicks` is not the answer either: it debounces against its private `firedAt`, and this screen debounces against the `askedAt` its SCHEDULED tick writes too. The item also predates the `plan:archive seq:19` rebuild branch and the `plan:live seq:22` repair, so its "four rules" description is now five behaviours; the dispatch brief's claim that `attachLook` was already exported was also wrong - it was module-private until this lane.

MEASURED, on `/lane.html` in both browser projects. With the shared `askedAt`: a glance fired inside 250 ms of a scheduled `/tip` costs 0 extra requests. With `startLookTicks`' private-clock semantics installed: 1 extra request, both projects. That is the number that decided the shape.

EVERY BEHAVIOUR THE ITEM PREDATES SURVIVES: `shouldPing`, `LOOK_GAP_MS`, the interval re-base, the rebuild-at-tail branch, the `conv.doc.replaced` notice above the tail, the pruned branch and `fillHead`. 202 archive e2e tests - `conversations`, `conversations-kept`, `conversation-secrets`, `archive-chrome-face`, `lane-link-face` - pass SERIALLY on `chromium` and `chrome`, 7.7 min, zero failures.

AND THE LOOK TICK IS NOW MEASURED ON THE SECOND PAGE, which nothing did before. `lane.js` imports `mountDocument` and forks nothing, so a bare lane window runs the same follow - and it is the only page where the document's own pair is the ONLY thing that can answer a return, since there is no heartbeat and no stream there to cover for a lost one. The new e2e test drives `/lane.html`: it follows, asks nothing while hidden, answers one glance with exactly one `/tip`, and drops a look landing inside the gap of a scheduled ask.

PROVED BY REMOVAL, five ways, red in both projects each time: un-export `attachLook` (2 unit tests red), re-inline the hand-written pair (cadence test red), drop `askedAt` from the scheduled tick (cadence test red), delete the adoption (`/lane.html` burst 1 to 0), install the private clock (extra asks 0 to 1). Unit suite 7276 tests, all green but `test/cli/statusline-chain.test.ts`, whose failure set rotated across three runs and which passes 28/28 alone - the known contention list.

Commit 1613f3b0.
