---
id: TASK-validation-is-against-the-whole-window-and-refuses-to-guess
type: task
title: validation is against the whole window, and refuses to guess without one
status: active
severity: soft
always: false
summary: Check that the limits add up against the real total, and refuse to check at all rather than guess when that total is unknown.
summary_of: efac662cd038dd19
scope: []
tags:
  - v2
  - injection
  - budgets
  - "plan:budget"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 38d2b9bac60e35fd
plan: budget
seq: "3"
state: done
priority: "1"
source: owner, 2026-08-27
needs: budget/2
---

# validation is against the whole window, and refuses to guess without one

`pinned + jit + restored + index` must fit `context_window_size`. A single budget that passes on its own while the four together do not is the failure mode this exists to prevent, and it is the one a per-field check cannot see.

THE CEILING IS ONLY KNOWABLE WHEN THE STATUS-LINE BRIDGE HAS SPOKEN. Without a sample there is no window size -- `context_window_size` is not in the transcript, and a model-to-window table was measured wrong by 5x on this machine (the transcript reports `claude-opus-5` with no `[1m]` suffix, so a table says 200k where the truth is 1M). **So without the bridge, REFUSE TO VALIDATE rather than validate against a guess.** A refusal names what is missing; a guessed ceiling silently accepts or rejects the wrong numbers.

A budget that technically fits and leaves nothing to work in is still wrong. Whether that reserve is stated as a number or a fraction is the one open choice here.
