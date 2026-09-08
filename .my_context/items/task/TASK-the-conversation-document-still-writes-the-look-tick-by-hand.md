---
id: TASK-the-conversation-document-still-writes-the-look-tick-by-hand
type: task
title: the conversation document still writes the look-tick by hand, one floor below the module that now owns it
status: active
severity: soft
always: false
summary: Two screens each carry their own copy of the rule that refreshes a page the moment you look back at the tab, and one of them should simply use the other's.
summary_of: 65ec240f6ef5a350
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/lib/heartbeat.js
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:29"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/archive29.md"
source_anchor: null
source_checksum: 3ffeace2515ba123
valid_from: 2026-09-08
valid_until: null
checksum: e77f7641a0bb54b4
plan: archive
seq: "29"
state: todo
priority: "3"
---

# the conversation document still writes the look-tick by hand, one floor below the module that now owns it

> FILED BY THE plan:live seq:21 / plan:archive seq:25 LANE, 2026-09-08, as the half of seq:25 it
> could not finish inside its own file boundary.
>
> WHAT SHIPPED. seq:25's chosen option was the item's first one: the four rules moved INTO
> `src/ui/public/lib/heartbeat.js`, which is where they belong because that module already exists to
> hold the RULE rather than the timer. `startHeartbeat(doc, pingFn, intervalMs, win)` now carries the
> listener pair on `doc.visibilitychange` and `win.focus`, the `LOOK_GAP_MS` double-fire guard, the
> interval re-base, and removal of both listeners in the same `stop()` that clears the timer -
> `app.js` calls that `stop()` from `api()`'s catch the moment a request proves the server is gone,
> so the tear-down is what keeps a dead page from pinging an exited process. `app.js` passes
> `window`. Measured in both browser projects: 8-15 ms from the look to `/api/ping` being asked,
> 23-24 ms to its answer being back, and exactly ONE request in the 300 ms after a return that fires
> `visibilitychange` and `focus` together.
>
> WHAT DID NOT. `screens/conversations.js` still carries its own hand-written copy of the same four
> rules - `onLook`, its own `LOOK_GAP_MS`, its own re-base, its own removal in `stopFollowing`. Not
> because the refactor is judged too wide: it is the right one, the shapes already match, and
> `heartbeat.js` was written to be adopted. It is because that file was owned by another lane running
> at the same hour, and editing it would have been a collision rather than a refactor.
>
> SO THIS IS THE ADOPTION, AND IT IS SMALL. `conversations.js` follows a document with `tipTimer` at
> `TIP_MS` and tears it down in `stopFollowing`; that is `startHeartbeat`'s shape with `tick` as the
> `pingFn`. What it has and the shared one does not is the `scroll.isConnected` guard that stops a
> document whose well was replaced - that belongs in the callback, not in the mechanism, and it is
> the one thing to get right while moving.
>
> WHAT THIS IS WORTH, so nobody reads it as urgent: nothing is broken and no reader waits. The value
> is that the next surface that wants the behaviour asks for `win` instead of writing the rules a
> third time, and that `test/ui/viewmodel.test.ts` is then the only place the guard and the tear-down
> are asserted. seq:25 named the failure to avoid in as many words: a second hand-written copy of the
> same four rules on a third surface.
>
> AND ONE NUMBER MUST NOT MOVE WITH IT. The 60 s cadence was ruled, not inherited - `measureCorpusDrift`
> rides `/api/ping` and its 6.24 ms/min budget is the argument that ruled out a file watcher. This is
> about the return, never the interval, and the same holds for `TIP_MS` on the document side.
