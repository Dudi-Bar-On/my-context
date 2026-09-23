---
id: TASK-one-unreadable-directory-makes-the-audit-projection-look
type: task
title: one unreadable directory makes the audit projection look diverged, and the sync deletes all of it
status: active
severity: soft
always: false
summary: A single read error can make the record of everything this project has done look out of date, and the repair then throws the whole record away.
summary_of: 12fbc5a86947b5c5
scope:
  - src/core/audit-db.ts
  - src/core/audit.ts
tags:
  - v2
  - store
  - audit
  - silent-failure
  - inferred
  - "plan:rulings"
  - "seq:80"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: e18197a2b16b3e23
plan: rulings
seq: "80"
state: done
priority: "1"
---

# one unreadable directory makes the audit projection look diverged, and the sync deletes all of it

INFERRED, NOT REPRODUCED. The chain was traced through the source; no `readdir` was ever made to fail and the deletion was never observed. THE FIRST STEP OF THIS WORK IS TO REPRODUCE IT on a throwaway workspace -- make one segment directory unreadable, run the projection sync, and count what is left. If the chain does not complete as read, that is a legitimate outcome and this item says so.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B6) as row 8 of `reports/2026-09-13-the-consolidated-findings.md`.

THE CHAIN AS READ. One `readdir` failure inside `auditSegments` returns `[]`. `projectionState` reads that empty list as DIVERGED. `syncProjection` then acts on divergence by issuing a `DELETE` over the whole projection and re-projecting from the empty list.

THE CONSEQUENCE. `mycontext audit` reports no records at all for a workspace that holds 45,440 of them. The record of what this project actually did is destroyed by a transient read error, with no disclosure anywhere.

WHY IT IS UNDER THIS SUBJECT. D52 is what reaches the audit record and whether its stores are current. This is the case where the store is current, the record is intact, and the projection deletes it.
