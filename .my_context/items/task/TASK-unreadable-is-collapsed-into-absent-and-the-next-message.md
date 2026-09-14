---
id: TASK-unreadable-is-collapsed-into-absent-and-the-next-message
type: task
title: unreadable is collapsed into absent, and the next message loudly asserts the absence
status: active
severity: soft
always: false
summary: A file that cannot be read is treated as a file that is not there, and the tool then announces loudly that the saved state is gone for good.
summary_of: 8ebcae8a2cc48e0a
scope:
  - src/core/**
  - src/hooks/**
tags:
  - v2
  - core
  - silent-failure
  - false-assertion
  - "plan:swallow"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7d5e7d871bac2311
plan: swallow
seq: "8"
state: done
priority: "2"
---

# unreadable is collapsed into absent, and the next message loudly asserts the absence

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M18) as row 40 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT THE CODE DOES. `readSnapshotMeta` collapses "unreadable" into "absent". PostCompact then asserts the absent version LOUDLY: "NO PreCompact snapshot for this session ... whatever this window held is not coming back."

THE CONSEQUENCE. The operator is sent to their hook configuration to debug a hook that fired correctly, while the real problem is on their disk. A confident sentence with the wrong cause costs more than silence, because it directs the search.

A SECOND DEFECT AT THE SAME SITE: a malformed `itemIds` yields a SUCCESSFUL read of an empty snapshot -- so a corrupt snapshot and a genuinely empty one are indistinguishable.
