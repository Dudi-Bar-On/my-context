---
id: TASK-on-a-working-corpus-the-audit-projection-is-stale-within
type: task
title: on a working corpus the audit projection is stale within minutes, so the Audit stream refuses most of the time
status: superseded
severity: soft
always: false
summary: Ordinary work makes the activity data out of date within minutes, so the history screen refuses to show anything most of the time.
summary_of: 37763840646308b1
acknowledged:
  - body_disagrees_with_meta@89b0776d7edf3e35
scope: []
tags:
  - "plan:ui3"
  - "seq:11x"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: 216656fd867ed34f
valid_from: 2026-08-22
valid_until: 2026-09-03
checksum: 1ec99ba384567ec0
state: done
plan: ui3
seq: 11x
---

# on a working corpus the audit projection is stale within minutes, so the Audit stream refuses most of the time

> Measured on this repository's own corpus on 2026-08-22 while building ui3 Task 11: the projection went from `fresh` to `behind` twice inside forty minutes, purely because ordinary work appended to `.audit/audit.jsonl`. Nothing syncs it except someone running `mycontext audit`.
>
> Every JSON endpoint the Audit stream reads — `/api/watch/volume` for the pulse and `/api/ask/audit` for the backlog — then answers 503, correctly and by design. The consequence on screen is that the pulse is empty, the filter row is `All` alone, the table is empty, and the only thing still working is the live stream, which reads the JSONL directly. Screenshot: `my-context/reports/2026-08-22-ui3-11-watch/watch-real-stale-projection-1568x779.png`. That is the state the owner looked at and called "far away from the mockup"; it is the honest rendering of a stale projection, not a rendering defect.
>
> The screen cannot fix it: syncing is a write and a read surface may not write. So the fix is elsewhere, and it is a product decision:
>
> - have the writer keep the projection current (append to it as the log is appended to), so a read surface never meets a stale one; or
> - have `mycontext ui` sync once at startup, which is a write by a command the user typed rather than by a GET; or
> - accept it, and make the refusal ACTIONABLE on screen — the message already names `mycontext audit`, and this UI has `lib/command.js` and the `.cmd` compose-and-copy row that `doctor` and `coverage` already use for exactly this shape.
>
> Whichever is chosen, the Audit stream is the screen that shows the cost.

RULED 2026-08-25. This task offered three ways out and called the choice a
product decision. The owner took the first:

  THE WRITER KEEPS THE PROJECTION CURRENT.

The other two were declined with reasons. Syncing once at `mycontext ui`
startup loses to the measurement in this very task -- twice in forty minutes
means the screens would go stale during the session that fixed them. Making the
refusal actionable is honest and cheap and was declined as the WHOLE answer,
because it leaves the product's most-used screens refusing by default with a
chore attached; it may still be worth adding for the cases a writer cannot
cover.

The implementation is plan:walk seq:28, which carries the failure mode as part
of the design: the log append must succeed independently, a failed projection
write must not fail the user's command, and it must not be silent.

AND A NOTE ON HOW LATE THIS WAS ANSWERED. On 2026-08-24 the e2e harness was
made to sync before serving, and that was reported as fixing "the fixture goes
stale" -- with a dramatic before-and-after, decay 86 to 549 nodes. It fixed the
measurement and not the product, and this task had been sitting here since
2026-08-22 saying so. Filed as its own lesson.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: SUPERSEDED BY plan:walk seq:28, "keep the audit projection current on the write path".

This task s deliverable was a MEASUREMENT and a choice between three ways out. It delivered both: fresh to behind twice inside forty minutes, and the owner took the first, 2026-08-25. walk seq:28 carries the build, at priority 1, with the failure mode written into the design.

CLOSING THIS DOES NOT MEAN THE DEFECT IS FIXED. It is not. On a real corpus the Audit stream still refuses within minutes of ordinary work, and it is the single defect on this board that is visibly broken for a user today rather than merely unbuilt. It is tracked at walk seq:28 and nowhere else -- if that task is closed without the write path changing, nothing else in the corpus will say so.

## Relations
- superseded_by [[TASK-keep-the-audit-projection-current-on-the-write-path]]
