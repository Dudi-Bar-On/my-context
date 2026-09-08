---
id: TASK-one-dead-stream-is-announced-on-every-screen-for-ever-and-a
type: task
title: one dead stream is announced on every screen for ever, and a poll would not have died at all
status: active
severity: soft
always: false
summary: A live feed that drops once keeps saying so on every screen until the page is reloaded, even though the server is still answering everything else.
summary_of: e4802dc29b740c98
scope:
  - src/ui/public/app.js
  - src/ui/watch-model.ts
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:21"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: b39dd72ad1effb02
plan: live
seq: "21"
state: todo
priority: "1"
---

# one dead stream is announced on every screen for ever, and a poll would not have died at all

Owner report 2026-09-08: "on the web status bar i see many times the message 'the stream refused to
continue: network error', is it a refresh issue and could it be solved like we did with other auto
refresh solutions?"

DIAGNOSED, AND IT IS TWO DEFECTS RATHER THAN ONE. The second is the reason he sees it MANY times.

DEFECT ONE - THE STREAM DIES AND THE SERVER IS FINE. Measured while he was reporting it: the server
is LISTENING on 58888 (its own pid), and there is a half-closed pair between the browser and it -
one end CLOSE_WAIT, the other FIN_WAIT_2. That is the signature of a long-lived connection dropped
without a clean close on both sides, which is what a held-open SSE fetch looks like when it is cut
underneath. Every ordinary read on the page keeps working throughout, because those are short
requests against a server that never went away.

DEFECT TWO - THE FAULT IS STICKY AND IS RE-ANNOUNCED FOREVER. `liveEnded` (`src/ui/public/app.js` -
`let liveEnded = null`) is SET when a fault arrives and is never cleared anywhere. `subscribeStream`
replays it to every new subscriber - "a screen that subscribes late is never left inferring the
stream's state from silence" - and `route()` subscribes on every screen it builds. So ONE dead
stream is re-announced on every screen navigation for the life of the page. He is not seeing many
faults; he is seeing one fault many times.

That replay is right in its original purpose - a screen subscribing after a fault must not think the
stream is healthy - and wrong as a permanent sentence, because nothing can ever clear it. The page
says the same true-once thing forever, with no way back short of a reload.

AND THE PROHIBITION IT ALL RESTS ON IS NARROWER THAN THE CODE TREATS IT. `liveStop` is set once and
never cleared because "reopening after a fault would be exactly the reconnection §2 forbids". What
§2 actually forbids is SILENT RECONNECTION OF A HELD-OPEN STREAM, and the reason is named: a page
that quietly re-establishes a persistent connection keeps the server alive for ever - "the daemon by
another name". That reasoning is about a PERSISTENT CONNECTION. It does not reach a short request.

SO THE OWNER'S INSTINCT IS THE ANSWER, AND plan:archive seq:19 IS THE PRECEDENT. That item faced the
same choice and chose polling over a socket for this exact reason. A visible-only poll:
  - holds NO connection, so there is nothing to lose and nothing to silently re-establish;
  - is a short request, so the idle monitor still exits with the tab open - §2's actual concern;
  - RECOVERS BY CONSTRUCTION. The next tick simply succeeds. No reconnect logic, no backoff, no
    state machine, and no sticky fault, because there is no connection whose death has to be
    remembered.
  - already has its rule imported rather than restated - `shouldPing`, so a background tab asks
    nothing.

WHAT TO DECIDE RATHER THAN ASSUME, and this is a real design call and not a formality:
  - REPLACE, OR FALL BACK? Replacing the stream with a poll is simpler and removes the whole
    `kind: 'stream'` idle carve-out from the audit path. Falling back keeps the stream's genuine
    advantage - an audit record appears the instant it is written - and uses the poll only after a
    fault. Falling back is more code and two paths to keep true; replacing costs immediacy on the
    one surface where immediacy was the point.
  - THE POLL'S CHEAP PROBE. seq:19's `/tip` works because a `stat` answers "has it grown" without
    opening the database - measured 0.057 ms against 1.930 ms for the version that opened SQLite.
    The audit log needs the equivalent question answered as cheaply, or a 1 s poll on the audit
    stream costs far more than the 6.24 ms/min budget that governs this. MEASURE IT BEFORE
    CHOOSING AN INTERVAL. `AuditTail` already tails the JSONL by offset and is the obvious place.
  - AND THE `resync` DISCIPLINE MUST SURVIVE whichever way it goes: the stream discloses when the
    log diverged under it rather than showing a hole, and a poll has exactly the same problem.

THE SMALLEST HONEST FIX, IF THE ABOVE IS DEFERRED, is still worth naming: clear `liveEnded` when a
subsequent read succeeds, so the page stops asserting a dead stream while it is demonstrably talking
to the server. That does not restore the live feed and must not pretend to - the chip would have to
say the feed is not live rather than that it just failed - but it ends the "many times" without
touching §2 at all.
