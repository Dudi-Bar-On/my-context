---
id: TASK-the-zero-data-view-gets-an-owner-an-empty-ledger-renders-as
type: task
title: "the not-projected view gets an owner: a missing ledger projection renders as its own state, not as the null state"
status: active
severity: soft
always: false
summary: When the history has never been summarised, say so and name the command that builds it, instead of showing what looks like nothing.
summary_of: e791c01ffb2b807f
scope: []
tags:
  - "plan:rulings"
  - "seq:26"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 8047bd5ce649b269
plan: rulings
seq: "26"
state: done
progress: "0"
priority: "2"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T14:15:21Z"
verified_on: 2026-09-05
---

# the not-projected view gets an owner: a missing ledger projection renders as its own state, not as the null state

**Re-decided 2026-08-21, because the first ruling was made about a different thing.**

The state was called `never-injected` when the zero-data ruling was taken, and that name was false. The ledger table is a PROJECTION of the audit log, written only by `topUpLedger` — reached by `mycontext status`, `mycontext decay` and `audit replay-ledger`, and by nothing else. The hook stopped writing it when dedupe moved to the seen file. So a corpus injected into a thousand times, on which no aggregate CLI reader has ever run, arrives with no ledger tables at all.

The state is now `not-projected` (src/ui/read-model.ts).

**The ruling: it renders as its own panel, not as the mockup's null state.** The panel says the history exists but has not been projected, and names the command that builds it. The null state means 'nothing here', which is exactly the false claim the rename removed from the code — rendering it would put the lie back on the screen after renaming it out.

**Not chosen:** having the server call `topUpLedger` on read. It would remove the state entirely, but it makes the UI server write, and ui1 task 14 bans the mutation surface from its import graph. That is a boundary decision, not a fix.

**Still unowned, and named here so it is not rediscovered:** projection staleness has nowhere to be reported. Index staleness has `index_stale`, surfaced by /api/status. This has nothing — `ledger-replay.ts` exports only the writer, there is no read-only 'how far behind' probe, and no doctor check reports it. The halves exist (`Ledger.sourceFiles()` / `sourceBytes()` against the segments on disk); the probe does not.

Affects ui1 tasks 9, 10 and 11 equally, and every screen carrying `LedgerPresence`.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and the reconciliation has just made it MORE relevant rather than less. It asks that a missing ledger projection render as its own state rather than as the null state -- an absence and a zero are two facts.

THAT IS THE SAME DISTINCTION THE PROJECT HAS NOW DRAWN FOUR TIMES INDEPENDENTLY, which means it is a principle rather than four opinions:
  watch draws a FLOOR LINE under an empty pulse, argued in its own header -- "a measured zero and an undrawn chart are two facts and the difference has to survive"
  the ask read model returns 200 with NO columns for a never-built projection, never 120 columns of zero, because that would be "a flat chart asserting nothing happened over a log the endpoint has not read"
  the export read model serves the third format rung as built:false rather than dropping it, so the page cannot silently invent a format
  this task, for the ledger

IT SHOULD BE RULED ONCE, AS A PRINCIPLE, and then applied here -- rather than decided a fifth time. And plan:walk seq:28 makes it urgent: the ledger projection is explicitly NOT covered by the projection ruling, and seq:28 s own body says to establish whether it has the same problem rather than assume.
