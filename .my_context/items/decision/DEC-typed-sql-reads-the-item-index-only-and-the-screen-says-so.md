---
id: DEC-typed-sql-reads-the-item-index-only-and-the-screen-says-so
type: decision
title: typed SQL reads the item index only, and the screen says so
status: active
severity: soft
always: false
summary: The typed-query screen may read only the item list, never the change log, and it must say so on screen instead of returning a puzzling empty result.
summary_of: 6bf6d44282311bb5
scope: []
tags:
  - v2
  - ui
  - owner-ruling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-01
valid_until: null
checksum: 5c252980693610af
---

# typed SQL reads the item index only, and the screen says so

> OWNER RULING, 2026-09-02. Both questions raised by plan:api seq:6 are settled.

QUESTION ONE - may a typed statement reach the AUDIT projection as well as the index?

INDEX ONLY, AND SAID PLAINLY ON THE SCREEN. Typed SQL reads the item index. The audit projection stays behind its own door and no typed statement crosses into it.

The binding half of this ruling is the second clause, not the first. seq:6 said "answering 'index only' is legitimate; answering it SILENTLY is not", and that is the part this ruling enforces: the screen must STATE the boundary, so that a reader who asks a cross-store question - progress from the index beside real change time from the audit log - learns WHY it cannot be answered here rather than receiving a confusing empty result. A silent empty result for a question the store was never allowed to answer is exactly the failure this project keeps rediscovering.

The screen must point such a reader at the two places the answer does live: the canned `report=tasks`, which exists precisely because it joins progress in the index to change time in the audit log, and `mycontext audit` for audit-side questions.

QUESTION TWO - what does the screen do with a statement the guard REFUSES?

SETTLED BY DEFERRAL, on seq:6's own reasoning. plan:rulings seq:46 fixes the read-only guard's false positives first - the forbidden tokens SQLite accepts as ordinary identifiers - so by the time this screen surfaces a refusal, only TRUE refusals exist. seq:6 does not need to solve the wrong-refusal case because that case is being removed rather than explained.

This preserves the ordering already reconciled under plan:walk seq:23: rulings/46, then api/6, then ui3/15. It also leaves the ordinary requirement standing - a true refusal must still be readable by the person who typed the statement - but that is the guard's own message surfaced, not a special explanation for a defect.

WHAT THIS DOES NOT CHANGE. The read-only guard is reused, never reimplemented. The canned `report=tasks` stays.

## Relations
- refines [[DEC-the-ask-screen-accepts-typed-sql-reversing-shown-never-typed]]
