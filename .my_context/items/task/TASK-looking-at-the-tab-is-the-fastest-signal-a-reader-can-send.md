---
id: TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send
type: task
title: looking at the tab is the fastest signal a reader can send, and the follow ignores it until the next tick
status: active
severity: soft
always: false
summary: Coming back to the browser shows the latest turns straight away, instead of waiting for the next scheduled check before it even looks.
summary_of: 0dc1d7aeb3c8dead
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:22"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: fea02166c43d5b29
plan: archive
seq: "22"
state: done
priority: "1"
needs: archive/19
---

# looking at the tab is the fastest signal a reader can send, and the follow ignores it until the next tick

Owner observation 2026-09-08, watching the viewer follow his own live session: "i sow that the
session opened on the browser was updated as we go, it just took it some time to be updated". The
following works - plan:archive seq:19 landed - and the LATENCY is the defect.

WHERE THE TIME ACTUALLY GOES, measured against the shipped code rather than guessed:

  - `TIP_MS = 5_000` (`src/ui/public/screens/conversations.js` - `const TIP_MS`). Up to five seconds
    between polls, by design and correctly so: the probe is cheap but not free.
  - THE TICK IS VISIBLE-ONLY. `tick` opens with
    `if (!shouldPing(document.visibilityState)) return;` - the heartbeat's own rule, imported rather
    than restated, so a tab nobody is looking at stops asking and cannot hold the server up. That
    rule is right and must stay.
  - AND THERE IS NO `visibilitychange` LISTENER ON THIS SCREEN. Measured: `visibilityState` appears
    exactly once in the file, in the line above. So when the reader comes BACK to the tab, the
    screen waits for the next SCHEDULED tick before it even asks.

THAT LAST ONE IS THE WHOLE ITEM. The other two are the design; this is the gap. A reader who looks
at the tab has declared interest in the most direct way a browser can report, and the screen answers
by waiting up to five more seconds before asking a 0.057 ms question.

AND IT IS WORSE THAN FIVE SECONDS, WHICH IS WHY THIS IS WORTH FIXING RATHER THAN TUNING. Browsers
throttle timers in hidden tabs - Chrome drops background `setInterval` to roughly once a minute after
a few minutes hidden. The interval does not merely skip while hidden, it FIRES LESS OFTEN, so the
first tick after the reader returns can be a long way off. That is the shape of what the owner saw:
watching it, about five seconds; switching to it, one throttled interval and then a catch-up.

WHAT TO BUILD: tick IMMEDIATELY when the document becomes visible, in addition to the interval.
Roughly - add a `visibilitychange` listener that calls `tick()` when `shouldPing` now passes, and
tear it down with the rest of the follow machinery.

FOUR THINGS TO GET RIGHT, and they are the reason this is not a one-liner:
  - TEAR-DOWN. `stopFollowing` clears `tipTimer`; a document-level listener added here MUST be
    removed there too, or every conversation opened in a session leaves one behind and they all fire
    on the next tab focus. The `scroll.isConnected` guard already in `tick` limits the damage but is
    not a substitute for removing the listener.
  - DO NOT DOUBLE-FIRE. Becoming visible a moment before a scheduled tick would send two `/tip`
    requests back to back. Harmless at 0.057 ms, untidy in the network panel, and it will be read as
    a bug by whoever looks next. Either reset the interval on the manual tick or drop a tick that
    lands within a threshold of the last one.
  - THE RULE ITSELF DOES NOT MOVE. This makes a visible tab respond faster; it must not make a
    HIDDEN tab ask at all. `shouldPing` stays the gate, and `test/ui/viewmodel.test.ts` already
    asserts that rule in isolation - it must still pass untouched.
  - A REFILL IS NOT A REPAINT. On return the file may have grown by a great deal, so the tick may
    trigger a large tail read. That is the existing `refill` path and it is bounded, but if the
    reader had scrolled up, the "N new below" count must be correct after a big jump rather than
    only after a small one.

AND THE SAME GAP IS WORTH CHECKING ON THE SHELL, said here rather than assumed: `startHeartbeat`
(`src/ui/public/lib/heartbeat.js`) has the identical shape - visible-only, no `visibilitychange`
listener - so the STATUS STRIP has the same delay on return. It is far less noticeable at a 60 s
cadence and is NOT in this item's scope, but if the same listener belongs in both places it should be
one mechanism rather than two.

OWNER RULING 2026-09-08, raising the bar past the focus listener above: "it should occure
immediate as possible". So the interval is in scope too, not only the return-to-tab case.

THE FLOOR IS ONE SECOND, AND IT IS ARITHMETIC RATHER THAN TASTE. The 60 s heartbeat ruling exists
to protect measureCorpusDrift's 6.24 ms/min. `/tip` costs 0.057 ms per call, so:

    5000 ms    12 calls/min    0.68 ms/min    under budget   <- today
    2000 ms    30 calls/min    1.71 ms/min    under budget
    1000 ms    60 calls/min    3.42 ms/min    under budget   <- RECOMMENDED
     750 ms    80 calls/min    4.56 ms/min    under budget
     500 ms   120 calls/min    6.84 ms/min    OVER budget
     250 ms   240 calls/min   13.68 ms/min    OVER budget

So one second is the round number that still sits comfortably inside the budget the existing
ruling defends, and half a second is the first step that breaks it. Take 1000 ms.

AND THE PER-TAB MULTIPLIER IS THE THING THAT WILL BITE, so it is written down before somebody
discovers it: that table is per OPEN DOCUMENT. Three tabs on three sessions at 1000 ms is
10.26 ms/min, already over the sweep. The visible-only rule is what makes this survivable - a
background tab contributes nothing - but if the interval is lowered, the disclosure that it is
per-tab must be in the code comment beside the constant, not left in this item.

WHAT IS DELIBERATELY NOT DONE, AND IT IS THE ONLY WAY TO BEAT ONE SECOND. Truly immediate means a
PUSH: the server tells the page the moment the file grows, and `/api/watch/stream` already proves
this codebase can do it. seq:19 ruled against a second long-lived socket on a READ surface, and
the whole `kind: stream` idle carve-out exists because an open stream must not hold the process
alive. That reasoning has not changed, and one second is inside human reaction time for a document
somebody is watching fill up. If the owner wants sub-second he should be told it costs the socket
decision, and it is his to reopen - not a lane's to assume.

SO THE DELIVERABLE IS THREE THINGS, in order of how much latency each removes:
  1. TICK ON BECOMING VISIBLE (and on window focus, which fires in cases visibilitychange does
     not - a window raised without a tab change). This is the big one: it converts "up to a
     throttled interval" into one round trip.
  2. TIP_MS 5000 -> 1000, with the per-tab arithmetic in the comment.
  3. THE DOUBLE-FIRE GUARD from the list above becomes load-bearing rather than tidy at 1000 ms,
     because a focus tick and a scheduled tick are now much more likely to land together.

CLOSED 2026-09-08, and the number that closes it is the RETURN case rather than the interval.

MEASURED END TO END, appended-to-on-screen, on two browsers:
    tab in front, six probes      438 - 949 ms
    returned to the tab           42 - 117 ms

The second row is the whole item. There was no visibilitychange listener at all, so a reader who
looked at the tab waited for the next SCHEDULED tick - and hidden-tab throttling meant that could
be a minute. It is now one round trip.

The ~950 ms on the first probe is where in the period the append landed, not overhead: the round
trip adds nothing meaningful to the interval. So a watched tab is about half a second typical and
one second worst.

BUILT: onLook on BOTH document.visibilitychange and window.focus - a window raised without a tab
change fires one and not the other - removed in stopFollowing beside tipTimer. TIP_MS is 1000, and
the per-open-document arithmetic sits in the comment beside the constant rather than only here,
because three tabs at 1000 ms is 10.26 ms/min and already over the 6.24 ms/min sweep. It did not go
below 1000, as instructed.

THE DOUBLE-FIRE GUARD BECAME LOAD-BEARING, as this item predicted: LOOK_GAP_MS 250 drops the
second of the visibilitychange+focus pair, and the interval is RE-BASED on a manual tick so a look
tick and a scheduled tick cannot collide. A test prints the count - one /tip in the 300 ms after a
look.

AND A CORRECTNESS FIX IN refill THAT NOBODY ASKED FOR AND IS RIGHT: seenBytes now takes
walkedBytes on a truncated tail rather than the full size. Recording the full size would have
marked the document current at a size it never read to - a hole drawn as continuity. Unreachable in
practice (it needs 256 MB of appends while away) and exactly the big-jump class this item names.

ONE THING THIS ITEM COULD NOT HAVE KNOWN, and it constrains every future test here: A GENUINELY
HIDDEN TAB IS NOT REACHABLE IN PLAYWRIGHT. Four ways measured - newPage plus bringToFront,
window.open, CDP Emulation.setPageVisibilityOverride (removed from the protocol) and
Page.setWebLifecycleState frozen - and every page stays visible, because Playwright gives each page
its own top-level window rather than a tab. The return test therefore overrides
Document.prototype.visibilityState and dispatches the real events into the real handler, and is
kept honest by its own first half: six seconds hidden with a real append on disk must produce ZERO
/tip requests, which a stub the code ignored would fail. The browser own background throttling is
the part no test can stage, and the file says so.

AND THE DISCLOSURE SENTENCE LOST ITS SLOT. At 1000 ms it spelled "every 1 seconds" / "כל 1 שניות",
and this string table has already refused count-plural constructions twice for want of a plural
rule. The number is written into both translations, and test/ui/conversation-follow-cadence.test.ts
holds them to TIP_MS - so the interval cannot move without both sentences moving with it.
