---
id: TASK-audit-projection-a-read-only-door-so-a-get-cannot-rebuild
type: task
title: "audit projection: a read-only door, so a GET cannot rebuild .audit.db"
status: active
severity: soft
always: false
summary: Simply viewing the history page can delete and rebuild its database; looking at something must never rewrite it, and staleness should be reported.
summary_of: 85de0a0acba37b81
scope: []
tags:
  - "plan:rulings"
  - "seq:22"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: f66753e70936e637
plan: rulings
seq: "22"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T17:09:50Z"
---

# audit projection: a read-only door, so a GET cannot rebuild .audit.db

Ruling C1 - the other half of the expert-review addendum's 'and reads write'. The Ledger half is fixed and the pattern is proven twice.

/api/ask/audit calls syncProjection, and audit-db.ts's openProjection rmSyncs and RECREATES .audit.db. So a GET can delete and rebuild a database on a surface whose entire premise is that it cannot write.

Mirror Ledger.openReadOnlyChecked, which shipped in commit 1cb968a: open read-only, verify what can be verified, throw a DISCLOSED state on stale or absent rather than rebuilding, and close the handle before the throw escapes. A stale projection is a state to report, not a thing to fix behind the user's back.

Read the Ledger door first - it worked out what 'checked' means when there is no version to compare, and the audit projection may have the same problem.
