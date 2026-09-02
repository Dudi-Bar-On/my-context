---
id: DEC-typed-sql-reaches-both-stores-and-the-screen-names-which-one
type: decision
title: typed SQL reaches both stores, and the screen names which one answered
status: active
severity: soft
always: false
summary: A question you type may be asked of either store of records, but only one at a time, and the answer always says which one it came from.
summary_of: 250bf3f3a3bbabe9
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - api
  - "screen:ask"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 497cc58bc6423521
---

# typed SQL reaches both stores, and the screen names which one answered

OWNER RULING 2026-08-25, answering question ONE of `plan:api seq:6`, which `DEC-the-ask-screen-accepts-typed-sql` required be decided WHILE the surface is built rather than after.

THE QUESTION: may a typed statement reach the AUDIT projection as well as the corpus index? They are separate stores behind separate doors.

THE RULING: BOTH -- and the screen says which store answered.

WHY: the interesting questions cross both, and the product already proves it. The canned `report=tasks` exists PRECISELY because progress lives in the index and the real change time lives in the audit log; the filter row cannot express it, which is the measured reason typed SQL was accepted at all. Serving only the index would leave the reversal answering a smaller question than the one that motivated it.

WHAT IT IS NOT: it is NOT a join across the two. Each statement runs against ONE store, through that store s own read-only door, under that store s own guard. A cross-store join was considered and declined -- it is a new surface the query guard has never seen, and nothing in the measured need requires it.

THE DISCLOSURE IS PART OF THE RULING, not a nicety. A reader looking at rows must be able to tell whether they came from the index (which this surface never rebuilds -- it reads exactly what the hooks read) or from the audit projection (which can be BEHIND, and refuses when it is). Those two caveats are different and both already exist on screen for the canned reports. An unlabelled result would merge them.

ORDER OF WORK IS UNCHANGED AND MATTERS: `plan:rulings seq:46` FIRST -- the read-only guard refuses twelve keywords SQLite accepts as ordinary identifiers, and this ruling doubles the number of doors that guard now stands in front of. Reusing a wrong guard ships the wrongness to a browser, where a reader has less recourse than a terminal user who can rephrase.
