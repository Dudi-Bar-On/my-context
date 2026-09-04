---
id: TASK-every-screen-declares-what-invalidates-it-and-a-gate-holds
type: task
title: every screen declares what invalidates it, and a gate holds it to that
status: active
severity: soft
always: false
summary: Each screen states what kind of change makes its data stale, and a check ensures none was simply forgotten, including those that never go stale.
summary_of: 9de53bd5eb4bb543
scope: []
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: cddd9ffdbfc91cf6
plan: live
seq: "2"
state: done
priority: "1"
source: owner, 2026-08-27
---

# every screen declares what invalidates it, and a gate holds it to that

A map from screen to the audit record kinds that make its data stale, plus a gate asserting EVERY screen has an entry -- including the ones whose entry is "nothing".

WHY A DECLARATION AND NOT A BLANKET RE-RENDER: hooks write audit records on every tool call, so an ordinary working session produces a steady stream of them. A screen that re-renders on any record would re-render constantly, and the ones that do not care -- Tutorials, Learn, the docs viewer -- would be doing it for nothing.

WHY A GATE: "nothing invalidates me" is a legal and common answer, and it is indistinguishable from "nobody thought about this screen" unless it is written down. The gate is what makes the difference readable. This is the same shape as `plan:rulings seq:50`, filed today: a hand-maintained table that nothing forces you to update is a table that goes stale silently.

BURSTS ARE COALESCED, and the debounce is stated in the code rather than tuned. One mutation is several rows.
