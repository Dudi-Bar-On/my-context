---
id: TASK-precompact-records-the-occupancy-and-the-trigger-it-fired-at
type: task
title: PreCompact records the occupancy and the trigger it fired at
status: active
severity: soft
always: false
summary: Record how full a session was and what caused it to be compressed, so the right cut-off is measured instead of argued about.
summary_of: 9a6919fb363c7dfe
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - "plan:handover"
  - "seq:7"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 2291eb42e225f139
plan: handover
seq: "7"
state: done
priority: "2"
source: owner, 2026-08-27
---

# PreCompact records the occupancy and the trigger it fired at

This item tracks state only. The task itself is Task 7 of docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md, which carries the tests, the code and the commit message.

This is what turns the threshold from an argument into a measurement. `trigger` distinguishes an automatic compaction from a manual one — `io.ts` declares it and `pre-compact.ts` does not read it today — and the percentage beside it is the number the platform ACTUALLY compacts at.

It is the answer to OPENQ-is-98-the-right-threshold-when-the-platform-compacts. After a handful of automatic compactions the corpus knows the real number and nobody has to argue. An unmeasurable occupancy is `null`, never zero and never a guess.

Buildable now, and independent of the ask.
