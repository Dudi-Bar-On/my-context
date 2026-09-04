---
id: TASK-ruling-12-sessionsummary-gains-the-session-name-mycontext
type: task
title: "ruling 12: SessionSummary gains the session name mycontext owns"
status: active
severity: soft
always: false
summary: The session picker should show the name a session was given, which the data behind it does not yet carry.
summary_of: 33963f6870fbdfba
scope: []
tags:
  - "plan:rulings"
  - "seq:10"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 89149f6f9e0d485d
plan: rulings
seq: "10"
state: done
progress: "0"
priority: "2"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T11:11:10Z"
---

# ruling 12: SessionSummary gains the session name mycontext owns

The mockup's picker shows short id, an optional NAME and a time; SessionSummary has no name field. Source it from wherever 'mycontext session name' stores it. itemCount STAYS in the read model but nothing renders it - a read-model field is not a screen element.
