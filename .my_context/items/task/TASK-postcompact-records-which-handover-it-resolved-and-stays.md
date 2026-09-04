---
id: TASK-postcompact-records-which-handover-it-resolved-and-stays
type: task
title: PostCompact records which handover it resolved, and stays silent
status: active
severity: soft
always: false
summary: Record which handover note was picked up when a session's history is compressed, while printing nothing to the person using it.
summary_of: bee4a51d7f45bbea
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - "plan:handover"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 7a8f297a9481dcf3
plan: handover
seq: "4"
state: done
priority: "1"
source: owner, 2026-08-27
---

# PostCompact records which handover it resolved, and stays silent

This item tracks state only. The task itself is Task 4 of docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md, which carries the tests, the code and the commit message.

Three fields on the audit row it already writes: `handoverPath`, `handoverState` and `handoverLines`. It reads and records; it does not act and it does not speak, because it cannot — its stdout becomes a user-facing banner and the model never sees it.

The assertion that makes this task worth its own commit is the one that says stdout is still empty.
