---
id: TASK-the-status-strip-has-the-same-return-to-tab-delay-the
type: task
title: the status strip has the same return-to-tab delay the document just lost
status: active
severity: soft
always: false
summary: The status bar can show a stale reading for a while after you come back to the tab, instead of refreshing as soon as you look at it.
summary_of: 22cfe9784bf677cf
scope:
  - src/ui/public/lib/heartbeat.js
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:25"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/hb.md"
source_anchor: null
source_checksum: 329b07951ae0fa2a
valid_from: 2026-09-08
valid_until: null
checksum: fe693b28eafc4960
plan: archive
seq: "25"
state: done
priority: "3"
---

# the status strip has the same return-to-tab delay the document just lost

> Found by the archive/22 lane while building the return-to-tab tick, reported rather than fixed
> because `TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send` puts the shell out of its
> own scope in as many words: "It is far less noticeable at a 60 s cadence and is NOT in this item's
> scope, but if the same listener belongs in both places it should be one mechanism rather than two."
>
> THE SHAPE, and it is the identical shape archive/22 just repaired one floor up. `startHeartbeat`
> (`src/ui/public/lib/heartbeat.js` - `export function startHeartbeat`) is a bare
> `setInterval` whose callback asks `shouldPing(doc.visibilityState)` and returns when the answer is
> no. There is no `visibilitychange` listener and no `focus` listener anywhere in that module, and
> `app.js` adds none around it. So a reader who comes back to the tab waits for the next SCHEDULED
> beat before the STATUS STRIP even asks - and because browsers throttle a hidden tab's `setInterval`
> towards once a minute, that wait is a throttled period rather than the 60 s the ruling chose.
>
> WHAT ARRIVES LATE, said concretely rather than as "the strip": everything `/api/ping` carries -
> model, window, corpus items, session, cost, audit, injections-this-context - plus
> `measureCorpusDrift`'s "in step with the log" line. A reader returning to the tab is looking at a
> strip that may be a minute or more old and that does not say so.
>
> WHY IT IS WORTH LESS THAN archive/22 WAS, so nobody reads this as urgent: the strip changes once
> per assistant message and the document changes many times inside one turn - `app.js`'s own comment
> is that what makes a minute enough there is that "the sample under it is rewritten once per
> assistant message". A stale strip is a stale number; a stale document is a reader watching a
> session that appears to have stopped.
>
> THE FIX ARCHIVE/22 ALREADY WROTE, and the reason this is filed as one mechanism rather than two.
> `screens/conversations.js` now carries `onLook`: it gates on `shouldPing`, drops a tick landing
> within `LOOK_GAP_MS` of the last, re-bases the interval so a manual tick and a scheduled one cannot
> collide, and is removed in `stopFollowing` alongside the timer. Measured after that change: 42-75 ms
> from becoming visible to the appended record being drawn, against a 1000 ms interval, and exactly
> one request in the 300 ms after the look. `startHeartbeat` wants the same four properties, and
> `heartbeat.js` is where they belong - it already exists to hold the RULE rather than the timer, and
> `test/ui/viewmodel.test.ts` already asserts `shouldPing` in isolation.
>
> SO THE DELIVERABLE IS: give `startHeartbeat` an optional look-tick - the listener pair, the gap
> guard and the interval re-base - and have `conversations.js` use it instead of its own copy, so
> there is one mechanism and one test. If that refactor is judged too wide for the value, the honest
> alternative is to say so here and leave `conversations.js` as the only surface with the behaviour;
> what must not happen is a second hand-written copy of the same four rules on a third surface.
>
> ONE THING TO CHECK BEFORE BUILDING IT, because it is what makes the strip different from the
> document: `app.js` calls `startHeartbeat`'s returned `stop()` from `api()`'s catch the moment a
> request proves the server is gone, and the header on that module says the heartbeat "must not
> itself be what reconnects (spec 2: silent reconnection would reintroduce the daemon by another
> name)". A focus tick fired after that stop would be exactly that reconnection. So the listeners
> must be removed by the same `stop()`, not merely gated - the tear-down archive/22 got right for its
> own timer is load-bearing here for a different and stronger reason.
