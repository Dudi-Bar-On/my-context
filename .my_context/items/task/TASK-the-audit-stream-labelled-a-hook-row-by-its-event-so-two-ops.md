---
id: TASK-the-audit-stream-labelled-a-hook-row-by-its-event-so-two-ops
type: task
title: the audit stream labelled a hook row by its event, so two ops sharing an event were indistinguishable
status: active
severity: soft
always: false
summary: Three ops shared one event name on screen, so a step and a stop read identically and neither named itself.
summary_of: caad97d9edbff075
scope: []
tags:
  - v2
  - backfill
  - "plan:walk"
  - "seq:135"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 20372d29a3782238
plan: walk
seq: "135"
state: done
verified_on: 2026-09-04
priority: "3"
---

# the audit stream labelled a hook row by its event, so two ops sharing an event were indistinguishable

The record table led a hook row with the platform event rather than the op. That held while every hook op mapped one-to-one onto an event, and broke when two ops began sharing one. The op is now the primary word for every kind, with the event beside it as detail. Shipped in b561c07 and the commits around it; the docblock carries the struck reason.
