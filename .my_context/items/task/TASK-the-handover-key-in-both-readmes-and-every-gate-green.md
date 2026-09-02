---
id: TASK-the-handover-key-in-both-readmes-and-every-gate-green
type: task
title: the handover key in both READMEs, and every gate green
status: active
severity: soft
always: false
summary: Document the new setting in both language guides, and run the checks the way the project runs them.
summary_of: ef741b90870a2ff7
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - docs
  - "plan:handover"
  - "seq:8"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 4a7ed8445dc152dd
plan: handover
seq: "8"
state: todo
priority: "3"
source: owner, 2026-08-27
---

# the handover key in both READMEs, and every gate green

This item tracks state only. The task itself is Task 8 of docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md, which carries the tests, the code and the commit message.

`test/docs/parity.test.ts` holds `README.md` and `docs/README.he.md` to the same sections, so a key documented in one must be documented in the other. Three things about `handover`: what it delivers, that it is off unless configured, and that `thresholdPercent` needs the status-line bridge or it stands down and says so.

Run the gates the way the project runs them — a hand-assembled invocation is refused by a pinned rule.
