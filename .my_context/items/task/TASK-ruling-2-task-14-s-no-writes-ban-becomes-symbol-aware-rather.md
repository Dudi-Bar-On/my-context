---
id: TASK-ruling-2-task-14-s-no-writes-ban-becomes-symbol-aware-rather
type: task
title: "ruling 2: Task 14's no-writes ban becomes symbol-aware rather than module-level"
status: active
severity: soft
always: false
summary: The rule that the screens cannot change anything should check which functions they use, not which files they sit near, and be proven able to fail.
summary_of: efad66572f2c2d84
scope: []
tags:
  - "plan:rulings"
  - "seq:5"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: bbc0a0cb2d12dbff
plan: rulings
seq: "5"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T11:57:08Z"
---

# ruling 2: Task 14's no-writes ban becomes symbol-aware rather than module-level

The invariant is 'the UI cannot write', not 'the UI cannot import a file containing a writer'. Rejected the allow-list because it grows and each entry is a hole nobody re-examines - core/audit.ts is next and is larger. MUST be proven red against a deliberate appendJsonlLine import, or it is another checker that cannot fail.
