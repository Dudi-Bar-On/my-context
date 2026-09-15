---
id: TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody
type: task
title: two checks route their only disclosure to a surface nobody is on, and the doctor run shows nothing at all
status: active
severity: soft
always: false
summary: When a check cannot look, it stays silent on the one screen where a reader would notice, and says so only where nobody goes.
summary_of: b887f795365ba220
scope:
  - src/doctor/**
  - src/rules/**
tags:
  - v2
  - doctor
  - silent-failure
  - "plan:dxfindings"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: d4da0a67c851b037
plan: dxfindings
seq: "6"
state: todo
priority: "3"
---

# two checks route their only disclosure to a surface nobody is on, and the doctor run shows nothing at all

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`) named it as pattern P5. The consolidation carried P1, P2 and P4 into rows and carried P5 nowhere - the string "P5" does not appear in `reports/2026-09-13-the-consolidated-findings.md`, and neither does `checkGoverningSpillPressure`. Found 2026-09-15 by the audit at `rulings/90`.

WHAT REPORT 3 SAID, quoted: "P5 - The disclosure is routed to a surface nobody is on. Not silence exactly - worse, because it reads as coverage. `assertDoor`s `catch { return 0 }` argues that reporting against it would blame the door for the stores own damage - which `mycontext rules verify` is the surface for. The attribution argument is sound; the routing sends the only disclosure to a command that runs on nobody schedule, and (M23) that commands advertised remedy is unreachable. `checkGoverningSpillPressure` is the same trade made well - silent rather than alarmed when it cannot look, fully argued - but its last step is the same: A DOCTOR RUN SHOWS NOTHING AT ALL, NOT EVEN THAT THE CHECK COULD NOT LOOK. One `info` disclosure would preserve every stated property (read-only, not counted toward the exit code) and end the silence."

WHY IT IS D75 AND NOT D66. The catch is not the defect here and neither argument is wrong. Both were reasoned, both are documented, and the fix does not change either decision - it adds one `info` finding so that "the check could not look" is a thing the doctor page says. That is exactly what this subject is about: a finding earning its keep, including the finding that a check was unable to run.

ONE OF THE TWO HALVES MAY HAVE MOVED. `rulings/85` and `store/6` have both touched the rule-store door since the review. Re-read `assertDoor` before acting and say what it does today; the `checkGoverningSpillPressure` half was not touched by either.
