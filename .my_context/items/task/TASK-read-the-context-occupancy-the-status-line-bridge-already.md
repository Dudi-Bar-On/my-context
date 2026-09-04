---
id: TASK-read-the-context-occupancy-the-status-line-bridge-already
type: task
title: read the context occupancy the status-line bridge already collects
status: active
severity: soft
always: false
summary: Reuse the figure already collected for how full a session is, and name the reason plainly whenever it cannot be known.
summary_of: 35d185a173c7572d
scope: []
tags:
  - v2
  - hooks
  - handover
  - continuity
  - statusline
  - "plan:handover"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: ca41668863c5beb9
plan: handover
seq: "5"
state: done
priority: "2"
source: owner, 2026-08-27
---

# read the context occupancy the status-line bridge already collects

This item tracks state only. The task itself is Task 5 of docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md, which carries the tests, the code and the commit message.

A thin adapter over `classifyContext`, which ALREADY returns `{ state, usedTokens, windowSize, percent }` from Claude Code's own status-line payload. This task computes nothing.

It never guesses either: `context_window_size` is not in the transcript, so there is deliberately NO fallback that derives a percentage from transcript arithmetic — that needs a model-to-window table and such a table goes stale in silence. Three unmeasurable reasons, each NAMED: no-bridge, no-sample, unknown-shape.

Buildable now. What waits on the owner is whether the bridge gets installed at all — OPENQ-install-the-status-line-bridge-over-the-owner-s-current — and this task is correct either way.
