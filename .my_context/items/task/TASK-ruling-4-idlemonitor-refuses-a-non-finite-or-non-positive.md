---
id: TASK-ruling-4-idlemonitor-refuses-a-non-finite-or-non-positive
type: task
title: "ruling 4: IdleMonitor refuses a non-finite or non-positive window in the constructor"
status: active
severity: soft
always: false
summary: A nonsensical timeout should make the server refuse to start and say why, instead of running forever while polling constantly.
summary_of: b8de6c4f6942e0bb
scope: []
tags:
  - "plan:rulings"
  - "seq:2"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 9561b903a93cd2b4
plan: rulings
seq: "2"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T11:35:57Z"
---

# ruling 4: IdleMonitor refuses a non-finite or non-positive window in the constructor

Refuse where the invariant belongs so every caller is covered, not only Task 13. Today a non-finite idleMs means the server NEVER idles out plus a 1ms hot poll - measured, not theorised. A malformed flag must refuse to start and say why; no silent fallback, per INV-nothing-is-dropped-silently.
