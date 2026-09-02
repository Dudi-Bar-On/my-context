---
id: DEC-stop-and-filechanged-ship-registered-at-a-measured-per-turn
type: decision
title: Stop and FileChanged ship registered, at a measured per-turn cost
status: active
severity: soft
always: false
summary: "Two frequent background recorders stay on: the small delay each turn buys a complete record, and a complete record makes a missing entry meaningful."
summary_of: 1c939cbd2b86d5d4
scope: []
tags:
  - v2
  - hooks
  - owner-ruling
  - performance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 175ecc5d661cd63f
---

# Stop and FileChanged ship registered, at a measured per-turn cost

OWNER RULING, 2026-08-24, on the posture that landed with plan:hooks seq:21.

Eighteen events are registered, and two of them fire often. Both STAY.

`Stop` fires once per assistant turn and BLOCKS the turn ending - the platform waits for it, which is a user watching a prompt, and `hooks.json` gives it the tightest timeout of the ten for that reason. Measured 382ms end to end on a loaded box; the in-process work is 3.7ms p95, so the whole cost is the process spawn. What it records is nearly constant: `stop_hook_active=false; the assistant turn ended`, whose only varying field is set by OTHER people's stop hooks.

`FileChanged` costs a spawn per changed corpus file - so a `mycontext create` leaves a `file-changed` row beside its `create` row - at 273ms.

THE RULING AND ITS REASON: keep both. A complete turn-by-turn record has value the individual rows do not, because the ABSENCE of a stop row becomes meaningful - which is precisely what the re-survey's `StopFailure` candidate exists to disambiguate. A log with holes cannot support that question; a log without them can.

WHAT WAS WEIGHED AGAINST IT, so nobody re-argues it from the cost alone: dropping `Stop` is a one-line change and would save ~382ms on every turn end. It was declined deliberately, not overlooked.

WHAT WOULD REOPEN THIS: a measurement that the spawn is materially worse than 382ms on a quiet machine, or a platform affordance for a non-blocking observation hook. The second was not investigated and is the honest open question - if the record can be written without a turn waiting on it, this ruling costs nothing and should be revisited.
