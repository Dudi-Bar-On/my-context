---
id: TASK-keep-the-audit-projection-current-on-the-write-path
type: task
title: keep the audit projection current on the write path
status: active
severity: soft
always: false
summary: Keep the searchable copy of the activity log up to date as it is written, instead of letting it fall behind until someone runs a command.
summary_of: 09a6fa023b77b6dc
scope: []
tags:
  - v2
  - ui
  - audit
  - api
  - "screen:watch"
  - "plan:walk"
  - "seq:28"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 35f5827e96d28120
plan: walk
seq: "28"
state: done
priority: "1"
source: "plan:ui3 seq:11x, ruled 2026-08-25"
---

# keep the audit projection current on the write path

Carries out the ruling that the writer keeps the audit projection current.

TODAY: every append to `.audit/audit.jsonl` leaves the projection one record further behind, and only `mycontext audit` catches it up. Measured on this repository 2026-08-22: fresh to behind twice in forty minutes of ordinary work. Measured on the demo corpus 2026-08-24: the last forty records were all `access`, so READS do it too, not only writes.

THE WORK: the path that appends a record also updates the projection. Find the ONE place the append happens and put it there -- if there is more than one, that is the first finding and it is worth reporting before fixing anything, because a second appender is how this comes back.

THE FAILURE MODE IS THE DESIGN, not an afterthought:
- The log append MUST succeed independently. The log is the source of truth and is append-only; a projection problem may never cost a record.
- A failed projection write MUST NOT fail the user s command.
- It MUST NOT be silent. The resulting state -- log ahead, projection behind -- is one the read surface already reports honestly, so the correct outcome is that state and not a swallowed error.

THE ACCEPTANCE TEST IS THE SCREEN, not a unit test alone: after ordinary work on a real corpus, the Audit stream still draws its pulse, its filter row and its table. The 2026-08-22 screenshot of the failing state is at `my-context/reports/2026-08-22-ui3-11-watch/watch-real-stale-projection-1568x779.png` -- compare against it.

CHECK WHETHER THE LEDGER PROJECTION HAS THE SAME PROBLEM. It is a different store, it was once missed entirely in the demo corpus builder, and nothing in this ruling covers it. Establish rather than assume.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS at priority 1, and it must be DISPATCHED WITH the AUDIT_KINDS task or that one will be closed by mistake.

THE TRAP: this task stops /api/watch/volume 503ing, so the watch filter row stops collapsing to All alone, so plan:ui3 seq:11x ("no browser-reachable endpoint serves AUDIT_KINDS") will LOOK closed. It is not. The browser still derives its kind vocabulary from the KEY ORDER OF ONE BUCKET of a response that exists for another purpose, and it still fails SILENTLY -- fewer buttons, no refusal -- on an absent projection (200, no buckets), a diverged one and a damaged one.

Same file, same read path. Whoever is there should fix both.

AND THE LEDGER CHECK IN THIS TASK S OWN BODY HAS AN OWNER NOW: plan:rulings seq:26 asks that a missing ledger projection render as its own state rather than as the null state. That is the same distinction four other places in this product have drawn independently -- watch s floor line under an empty pulse, ask s 200-with-no-columns, export s built:false format rung. IT SHOULD BE RULED ONCE AS A PRINCIPLE rather than decided a fifth time.
