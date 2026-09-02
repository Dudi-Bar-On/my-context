---
id: TASK-r14-into-the-scope-decisions-spec-beside-r1-r13
type: task
title: R14 into the scope-decisions spec, beside R1-R13
status: active
severity: soft
always: false
summary: Add the newest requirement to the specification that lists them all, along with the four decisions taken about it.
summary_of: a415e374e9f550bd
scope: []
tags:
  - "plan:rulings"
  - "seq:18"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 8deb5835b88595bf
plan: rulings
seq: "18"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T17:09:50Z"
---

# R14 into the scope-decisions spec, beside R1-R13

The spec is the authority for the requirement list and R14 is not in it. Add it with its four rulings: the slash command writes config as the user's act; unknown TOP-LEVEL keys warn and are skipped rather than refusing the file; the UI is ENABLED BY DEFAULT (opt out); and does-not-affect-the-plugin is proven by a differential test, not asserted.

Record the reading that has not been corrected: enabled gates whether mycontext ui is PERMITTED. Nothing listens on a port, spawns, or changes behaviour until the user runs the command. Enabled is not running.

Record the cost of opt-out, so it is carried rather than forgotten: the no-effect claim now has to hold on the path EVERY install gets, and the DISABLED path becomes the less-travelled one. The differential test must drive both directions.
