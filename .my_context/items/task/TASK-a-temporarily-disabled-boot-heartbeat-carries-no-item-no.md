---
id: TASK-a-temporarily-disabled-boot-heartbeat-carries-no-item-no
type: task
title: a temporarily disabled boot heartbeat carries no item, no date and no re-enable condition
status: active
severity: soft
always: false
summary: A liveness check was switched off with a comment that names no reason, no date and no condition for switching it back on.
summary_of: 4fe1118ecb844604
scope:
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - refusal
  - heartbeat
  - "plan:swallow"
  - "seq:9"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 55f14d60680a2239
plan: swallow
seq: "9"
state: todo
priority: "3"
---

# a temporarily disabled boot heartbeat carries no item, no date and no re-enable condition

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m20) as row 106 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `// TEMPDISABLED void heartbeatPing();` sits at `app.js` · the commented-out `void heartbeatPing()` call (line 8349) with NO ITEM ID, NO DATE and NO RE-ENABLE CONDITION. It removes the boot beat that `heartbeatPing`'s own header argues for.

WHY IT IS MORE THAN A STRAY COMMENT. IN COMBINATION WITH ROW 6 IT IS THE ONLY BEAT SOME PAGES EVER GET: row 6 records that one failed request stops the heartbeat permanently, and this removes the one at boot. Together they are a page with no liveness signal at all.

AND IT BREACHES `RULE-a-refusal-states-its-unblocking-condition` in the smallest possible form: a refusal with no condition, no date and no owner.
