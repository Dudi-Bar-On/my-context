---
id: TASK-read-a-bounded-handover-block-and-say-what-it-left-behind
type: task
title: read a bounded handover block, and say what it left behind
status: active
severity: soft
always: false
summary: Pick out the part of a handover note written for whoever comes next, and say plainly what was left out when it would not all fit.
summary_of: 27af647c429fd1dd
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - "plan:handover"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: b76510c5cc2dc583
plan: handover
seq: "2"
state: done
priority: "1"
source: owner, 2026-08-27
---

# read a bounded handover block, and say what it left behind

This item tracks state only. The task itself is Task 2 of docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md, which carries the tests, the code and the commit message.

`src/core/handover.ts`. The MARKER wins: a heading whose text starts with the configured marker gives the section written FOR the next session, through to the next heading at the same level or higher. This project's handover already writes `### ⏭ DO THIS FIRST` — the convention exists and says precisely what the next session must do, so reading it is measuring the thing rather than its proxy. No marker falls back to the head, cut at a section boundary.

The block ENDS with what it left behind. REQ-every-list-and-table-declares-what-leaves-it-and-when-and is hard, and a truncated document is the same act as a truncated list: 40 lines of 1,435 delivered silently claims to be the handover and is not.
