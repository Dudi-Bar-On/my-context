---
id: TASK-stop-asks-for-the-handover-once-at-the-threshold-and-only
type: task
title: Stop asks for the handover once, at the threshold, and only for that
status: active
severity: soft
always: false
summary: When a session gets close to full, ask once for handover notes to be written, and never ask a second time.
summary_of: 5431de43068b0e02
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - "plan:handover"
  - "seq:6"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 2239a17bfc22c60f
plan: handover
seq: "6"
state: done
priority: "2"
source: owner, 2026-08-27
---

# Stop asks for the handover once, at the threshold, and only for that

This item tracks state only. The task itself is Task 6 of docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md, which carries the tests, the code and the commit message.

THE FIRST TEXT THIS PROJECT HAS EVER PUT ON Stop's STDOUT. The envelope has been left empty on purpose since the ten observation hooks landed, and DEC-stop-speaks-once-and-only-to-raise-the-handover is the ruling that opens it — narrowly. Do not use it for anything else while you are in there; the capture nudge stays on PostToolUse and that question is still hooks seq:21's.

Three small changes and a latch: `'Stop'` joins `HookEventName`, `Observation` gains an optional `context`, and `observeStop` sets it when the occupancy crosses `handover.thresholdPercent` and nothing has asked yet this session. A second ask after the model has written the handover is a loop, and a loop in a per-turn hook is the most expensive bug this design can ship.
