---
id: TASK-healtorntail-truncates-on-a-stale-size-bound-with-no-lock
type: task
title: healTornTail truncates on a stale size bound with no lock, where two concurrent writers is the ordinary case
status: active
severity: soft
always: false
summary: A repair routine can cut off records another process has just finished writing, in a situation the code itself describes as normal.
summary_of: f5cf259b23ac1c1b
scope:
  - src/core/audit-db.ts
tags:
  - v2
  - core
  - race
  - audit
  - inferred
  - "plan:swallow"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: cee7beb0186d8c87
plan: swallow
seq: "12"
state: todo
priority: "3"
---

# healTornTail truncates on a stale size bound with no lock, where two concurrent writers is the ordinary case

INFERRED, NOT REPRODUCED. The race was derived from the code plus the concurrency model the project states about itself; two concurrent writers were never run against this path and no record was ever seen truncated. THE FIRST STEP OF THIS WORK IS A CONCURRENT-APPEND HARNESS -- report 3 says so in as many words. If the race cannot be produced, that is a legitimate outcome and this item records it rather than being softened.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m6) as row 110 of `reports/2026-09-13-the-consolidated-findings.md`.

THE MECHANISM AS READ. `healTornTail` calls `truncateSync` on a STALE SIZE BOUND with no lock -- and `audit-db.ts` · the note that two concurrent writers is the ordinary case (line 318) states that two concurrent writers is the ORDINARY case here, not an edge one. So a second process's complete records can be truncated away by a heal that was computed before they were written.

WHY IT IS WORTH REPRODUCING RATHER THAN ASSUMING. If it holds, it destroys complete records in the log this project relies on to say what happened; and the same log is what row 1 shows exonerating a failure, so its integrity carries more weight than usual.
