---
id: TASK-ruling-3-correct-history-s-stated-purpose-it-is-not-the
type: task
title: "ruling 3: correct history()'s stated purpose - it is not the decay chart's data"
status: active
severity: soft
always: false
summary: One piece of code is documented as feeding a chart it does not feed; keep it, point it at what it really serves, and fix the description.
summary_of: a82aeac0d25c65ed
scope: []
tags:
  - "plan:rulings"
  - "seq:3"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: caa118c63f05d484
plan: rulings
seq: "3"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T11:32:32Z"
---

# ruling 3: correct history()'s stated purpose - it is not the decay chart's data

The mockup contradicts the plan twice: decay's unit is sessions not weeks, and the 90-day card reads audit_item.role joined to audit.at, explicitly not the ledger. Keep the method; repurpose it to the audit stream and provenance surfaces. Correct the plan's prescribed docstring so the false provenance is not reintroduced.
