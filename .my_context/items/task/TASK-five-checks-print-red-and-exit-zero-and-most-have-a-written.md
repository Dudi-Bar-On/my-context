---
id: TASK-five-checks-print-red-and-exit-zero-and-most-have-a-written
type: task
title: five checks print red and exit zero, and most have a written rationale for doing so
status: active
severity: soft
always: false
summary: Five checks report problems and then report success, so nothing ever stops because of what they found.
summary_of: edd8b3ef1486c26c
scope:
  - scripts/**
  - package.json
tags:
  - v2
  - gates
  - report-only
  - "plan:gates"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 031437e2369d82f7
plan: gates
seq: "4"
state: todo
priority: "2"
---

# five checks print red and exit zero, and most have a written rationale for doing so

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, G5) as row 70 of `reports/2026-09-13-the-consolidated-findings.md`.

FIVE CHECKS PRINT RED AND EXIT 0:
- `check:handover` -- 4 findings naming retired work, 7 carried instructions.
- `check:cited-items` -- 106 citations naming 23 retired items, 34 of them reading as a live ruling.
- `check:basis` -- 10 declarations naming a retired item.
- `check-ask-numbering`.
- `verify:citations` -- 57 corpus failures, with no flag that gates them.

AND MOST OF THEM HAVE A SOUND WRITTEN RATIONALE for being report-only, which is why this is one item rather than five arguments. The finding is the COMBINATION: report-only plus never-run equals not a gate. Row 16 is the never-run half; this is the report-only half; row 11 is the vacuous half.

THE WORK IS A DECISION PER CHECK -- gate it, or say in the check itself that it is a report and name what would make it a gate -- not a blanket switch to exit 1.
