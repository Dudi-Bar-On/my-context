---
id: TASK-the-handover-is-asked-for-again-at-every-percent-not-written
type: task
title: the handover is asked for again at every percent, not written once and left to go stale
status: active
severity: soft
always: false
summary: The handover is requested once and then never again while the window fills for hours, so it describes work that stopped being current.
summary_of: d923188f16749702
scope:
  - src/hooks/stop.ts
  - src/core/handover-ask.ts
  - src/core/config.ts
tags:
  - v2
  - handover
  - hooks
  - "plan:handover"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: cb84ff7430713a57
plan: handover
seq: "12"
state: todo
priority: "1"
---

# the handover is asked for again at every percent, not written once and left to go stale

Owner instruction 2026-09-06, given while the context window sat at 86.2% and the handover had
been written once: "when handover file is triggerd at 85%, every change up till the context window
is 100% occupy, i mean when the percentage increasing by 1%, you should always trigger the handover
update to stay as much updated as we could before compaction or new session start."

WHAT HAPPENS TODAY, and it is the opposite. `thresholdPercent` is 85 on this corpus. `MAX_ASKS` is
2 per context window. And once a verification returns `acted-on`, `satisfied: true` is latched and
gate 6 short-circuits every remaining turn - the only re-arm is the owner LOWERING the threshold.
So the handover is written once, early, and then the window fills for hours with nothing asking
again.

THE COST WAS MEASURED THIS MORNING by the handover review, from this corpus’s own audit log:

   ask 09-03 10:40 at 85.1%  written 10:43  window died 13:22 at 99.9%  -> 2h 39m stale
   ask 09-04 10:33 at 85.8%  written 10:34  window died 11:58 at 96.1%  -> 1h 24m stale
   ask 09-05 07:34 at 85.1%  written 07:35  window died 10:41 at 96.6%  -> 3h 06m stale

All three rows say `acted-on`. The review’s own conclusion: `acted-on` proves ordering, not
currency - some process changed that file’s mtime at some point after the ask. It does not prove
the handover describes the work done since. And the owner’s 85 makes it WORSE than the default 98
would: the lower the threshold, the longer the unwatched tail.

WHAT IS RULED: the ask re-arms on every whole percentage point crossed, from the threshold to 100.
Not a repeat of the same ask - a new one, because a percent of a 1M window is roughly ten thousand
tokens of work the current handover does not describe.

THIS REPLACES MAX_ASKS RATHER THAN RAISING IT, and the distinction matters. The bound existed to
stop nagging: two asks and then silence, because a third ask about the SAME state teaches nothing.
A percentage step is not the same state - it is new work. So the bound becomes progress-based and
is naturally capped at fifteen from 85 to 100, each one earned by real growth rather than by a
turn passing.

WHAT THE LATCH MUST NOW CARRY: the whole percent last asked at, so `satisfied` suppresses only
until the next step rather than for the rest of the window. `askedAtThreshold`’s lowering rule is
unaffected and stays.

TWO THINGS NOT TO BREAK. The stand-down path (occupancy unmeasurable) must still fire once and stay
quiet - it is not a percentage step. And the audit row must remain able to say WHICH ask a verdict
belongs to, or the log stops being able to answer "was this ask acted on" at all.
