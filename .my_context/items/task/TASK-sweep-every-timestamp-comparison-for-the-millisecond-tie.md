---
id: TASK-sweep-every-timestamp-comparison-for-the-millisecond-tie
type: task
title: sweep every timestamp comparison for the millisecond tie that broke the watch window
status: active
severity: soft
always: false
summary: One place compared two clock readings and broke when both happened in the same millisecond; nobody has checked whether the other places that compare clock readings can break the same way.
summary_of: a4dc85397952e27c
scope: []
tags:
  - "plan:release"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 1e0df686ada65991
plan: release
seq: "16"
state: todo
---

# sweep every timestamp comparison for the millisecond tie that broke the watch window

Owner ruling at checkpoint 1 (2026-09-22): take it. Origin: release/13 site 4 — src/core/context-share.ts bounded the /api/watch/context window with at >= preCompactAt, and a synchronous burst of recordAudit calls tied the millisecond, so a record from before the compaction counted as after it (CI run 35715432299: 3 injections / 6200 tokens against 2 / 2200). The fix bounds on the audit table's seq. The lane did not sweep the rest of the code for the same shape.

Closing condition: every comparison of two clock readings in src/ (at, since, until, createdAt, updatedAt, mtime, and the like, compared with <, <=, >, >=) is listed in the task's observation with one of three verdicts each - cannot tie (the two readings come from different scales or a tie is harmless), can tie and is now bounded on a monotonic fact (seq, a counter, insertion order) with a test that forces the tie the way test/ui/watch-model.test.ts does, or can tie and is left with a written reason. Files: whatever the sweep names; expected to touch src/core/ledger.ts, src/core/audit-db.ts, src/core/decay.ts, src/ui/watch-model.ts. Phase 4 (silent failures and disclosures), same lane group as the audit and ledger tasks.
