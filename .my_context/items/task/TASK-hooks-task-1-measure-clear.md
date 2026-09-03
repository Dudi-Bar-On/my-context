---
id: TASK-hooks-task-1-measure-clear
type: task
title: "hooks task 1: Measure /clear"
status: active
severity: soft
always: false
summary: Measure what actually happens when a conversation is cleared, which needs someone sitting at a live session to observe it.
summary_of: 6ea691ad47cb44dc
acknowledged:
  - body_disagrees_with_meta@ac4ca4157c9584da
scope: []
tags:
  - "plan:hooks"
  - "seq:1"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 63aa2d6fccaf3736
plan: hooks
seq: "1"
state: done
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md#task-1"
last_change: "2026-08-20T00:00:00Z"
priority: "4"
---

# hooks task 1: Measure /clear

Measure /clear — the measurement is taken; one interactive step remains

Task 1 of the hooks plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md at line 501 — that file is the authority, and this item tracks state only.

THE MEASUREMENT WAS TAKEN 2026-08-22 on branch `b16-clear-probe` and is recorded in `reports/probes/2026-08-20-clear-and-prompt-hooks.md`. Both questions are answered from measured payloads, cross-checked against a call trace of the shipped binary: `source` is `clear`, and the `session_id` is NEW. The plan section marks this task "ANSWERED, one step short of done" -- only its Step 2, which names a human typing at a terminal, is unrun, and nothing downstream is held by it.
