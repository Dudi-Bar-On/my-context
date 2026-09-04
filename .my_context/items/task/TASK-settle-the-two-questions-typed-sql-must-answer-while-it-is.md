---
id: TASK-settle-the-two-questions-typed-sql-must-answer-while-it-is
type: task
title: settle the two questions typed SQL must answer while it is being built
status: active
severity: soft
always: false
summary: "Two decisions to make while the typed-query screen is being built: what it is allowed to read, and what it shows when a query is refused."
summary_of: 33220988fa64a3af
scope: []
tags:
  - "plan:api"
  - "seq:6"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: b00371cfb608eafd
plan: api
seq: "6"
state: done
needs: rulings/46
---

# settle the two questions typed SQL must answer while it is being built

DEC-the-ask-screen-accepts-typed-sql-reversing-shown-never-typed says these "MUST BE DECIDED WHILE BUILDING IT, not after". Filed so they cannot be discovered afterwards.

ONE: may a typed statement reach the AUDIT projection as well as the index? They are separate stores behind separate doors, and the interesting questions cross both - the canned report=tasks exists precisely because progress lives in the index and the real change time lives in the audit log. Answering "index only" is legitimate; answering it silently is not.

TWO: what does the screen do with a statement the guard REFUSES? The read-only guard is keyword-based and has at least one measured false positive - TASK-the-query-read-only-guard-rejects-replace-a-scalar-function. A UI that surfaces refusals to a reader will surface that one, and a refusal a reader cannot read is the failure this project keeps rediscovering.

PREREQUISITES already filed: `ctx.api` has no POST (TASK-ctx-api-has-no-post-so-three-registered-endpoints-are), and the guard defect above. The guard itself must be REUSED, not reimplemented - the UI must not grow a second implementation of read-only enforcement.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is SECOND of the three typed-SQL tasks -- after plan:rulings seq:46, before plan:ui3 seq:15.

Its own framing is right and should be enforced: these MUST BE DECIDED WHILE BUILDING IT, not after, and it exists so they cannot be discovered afterwards.

QUESTION TWO IS ALREADY HALF-ANSWERED BY seq:46 and the reconciliation is joining them: "what does the screen do with a statement the guard REFUSES" has a measured answer about WHICH refusals it will meet -- twelve forbidden tokens SQLite accepts as ordinary identifiers. A UI that surfaces refusals will surface those. So the choice is not abstract: either fix the guard (seq:46) and the screen surfaces only true refusals, or do not, and the screen must explain a refusal that is wrong. The first is obviously better and is why seq:46 goes first.

QUESTION ONE -- may a typed statement reach the AUDIT projection as well as the index -- is untouched and is genuinely open. Its own note is the strongest argument for "yes": the canned report=tasks exists precisely because progress lives in the index and the real change time lives in the audit log, so the interesting questions cross both. "Index only" is legitimate; answering it SILENTLY is not.
