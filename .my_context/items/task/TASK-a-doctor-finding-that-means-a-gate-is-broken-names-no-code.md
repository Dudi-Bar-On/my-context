---
id: TASK-a-doctor-finding-that-means-a-gate-is-broken-names-no-code
type: task
title: a doctor finding that means a gate is broken names no code, no check and no item
status: active
severity: soft
always: false
summary: When one of the health checks itself breaks, the message says so without naming which check broke or what it was looking at.
summary_of: aef11a80cdde113d
scope:
  - src/doctor/checks.ts
  - src/doctor/**
tags:
  - v2
  - doctor
  - finding
  - anonymous
  - "plan:dxfindings"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: c4ba1214c7042c46
plan: dxfindings
seq: "3"
state: done
priority: "2"
---

# a doctor finding that means a gate is broken names no code, no check and no item

FOUND TWICE AT THE SAME LINES. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, adjacent to M24) and report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, G3) reached it separately. Row 67 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. When a doctor check throws, the finding reads `a doctor check threw: <message>` with NO CODE, NO CHECK NAME and NO ITEM -- although the `checks[]` index is in scope at the throw site and could name all three.

WHY IT IS THE WRONG FINDING TO BE ANONYMOUS. This is the one finding in the whole set whose meaning is "a gate is broken". Every other finding says something about the corpus and can be traced from the item it names. This one says something about the tool, and it is the only one that cannot say which part.

THE SUBJECT. A doctor finding earns its keep by being actionable. An anonymous `check_failed` costs attention and buys nothing.
