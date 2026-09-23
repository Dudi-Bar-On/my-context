---
id: TASK-recordaudit-reports-whether-it-wrote-and-fourteen-of-sixteen
type: task
title: recordAudit reports whether it wrote and fourteen of sixteen hook call sites drop the answer
status: active
severity: soft
always: false
summary: The component that saves the record of what happened says whether it succeeded, and almost every caller ignores that, including three that other code relies on.
summary_of: e4d0782f5399c6f5
scope:
  - src/hooks/**
  - src/core/audit.ts
tags:
  - v2
  - core
  - audit
  - silent-failure
  - "plan:rulings"
  - "seq:81"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 581cef1f012cbf0f
plan: rulings
seq: "81"
state: done
priority: "2"
---

# recordAudit reports whether it wrote and fourteen of sixteen hook call sites drop the answer

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M1) as row 33 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `recordAudit` returns `{ written, error }` -- the honest shape this project asks for -- and 14 OF 16 HOOK CALL SITES DISCARD IT.

THREE OF THE FOURTEEN ARE LOAD-BEARING, and each is load-bearing because a neighbouring comment says so:
- `pre-tool-use:388`, whose neighbour justifies its own best-effort posture on the grounds that "the audit record above already holds the delivery durably".
- `recordDeny`, which the source calls "the one hook action that CHANGES what a tool call does".
- `subagent-start:271`, described as the whole mechanism by which "a kill becomes evidence rather than silence".

THE CONSEQUENCE. Three separate guarantees this project makes in writing rest on a write whose failure nobody looks at. When it fails, the guarantee is silently void and the prose still asserts it.

WHY D52. This is exactly what reaches the audit record and whether it got there.
