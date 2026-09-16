---
id: TASK-healtorntail-truncates-on-a-stale-size-bound-with-no-lock
type: task
title: healTornTail truncates on a stale size bound with no lock, where two concurrent writers is the ordinary case
status: active
severity: soft
always: false
summary: Two programs writing the log at the same time could destroy each other's finished records; that was reproduced, fixed, and proved fixed.
summary_of: 3413d72ae472d611
summary_was:
  - 2026-09-16 A repair routine can cut off records another process has just finished writing, in a situation the code itself describes as normal.
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7c5e6994155bca25
plan: swallow
seq: "12"
state: done
priority: "3"
verified_on: 2026-09-16
---

# healTornTail truncates on a stale size bound with no lock, where two concurrent writers is the ordinary case

INFERRED, NOT REPRODUCED. The race was derived from the code plus the concurrency model the project states about itself; two concurrent writers were never run against this path and no record was ever seen truncated. THE FIRST STEP OF THIS WORK IS A CONCURRENT-APPEND HARNESS -- report 3 says so in as many words. If the race cannot be produced, that is a legitimate outcome and this item records it rather than being softened.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m6) as row 110 of `reports/2026-09-13-the-consolidated-findings.md`.

THE MECHANISM AS READ. `healTornTail` calls `truncateSync` on a STALE SIZE BOUND with no lock -- and `audit-db.ts` · the note that two concurrent writers is the ordinary case (line 318) states that two concurrent writers is the ORDINARY case here, not an edge one. So a second process's complete records can be truncated away by a heal that was computed before they were written.

WHY IT IS WORTH REPRODUCING RATHER THAN ASSUMING. If it holds, it destroys complete records in the log this project relies on to say what happened; and the same log is what row 1 shows exonerating a failure, so its integrity carries more weight than usual.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `96ab4288`. THE ITEM SAID THE RACE WAS INFERRED AND NEVER PRODUCED. IT PRODUCES. Six processes, barrier-synchronised, 150 records each through the real append path: a 1-byte torn tail destroyed 32 of 900 COMPLETE records, 256 KB destroyed 6, and 8 MB destroyed 94. The one-byte figure is the one that matters — the loss is not an artefact of a fixture built to make the backwards scan slow.

The heal is now serialised on the project's own pid-authoritative file lock, taken ONLY once a tear is established, so an ordinary append still pays one stat and one 1-byte read; and the append THROWS rather than appending past a fragment it could not heal. Post-fix 0 of 900 lost, every run. An intermediate design got it to 2–3 per 900 and was measured and discarded rather than shipped. Closed by the reconciliation in `rulings/93`.
