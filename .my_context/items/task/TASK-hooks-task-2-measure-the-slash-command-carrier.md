---
id: TASK-hooks-task-2-measure-the-slash-command-carrier
type: task
title: "hooks task 2: Measure the slash-command carrier"
status: active
severity: soft
always: false
summary: Find out what information a shortcut command actually carries, which needs someone to run one in a live session.
summary_of: 6e076be8944fee2a
acknowledged:
  - body_disagrees_with_meta@a9ecccb5aa0d6060
scope: []
tags:
  - "plan:hooks"
  - "seq:2"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 60904d862f0dea53
plan: hooks
seq: "2"
state: done
progress: "0"
source: "my-context/docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md#task-2"
last_change: "2026-08-20T00:00:00Z"
priority: "4"
---

# hooks task 2: Measure the slash-command carrier

Measure the slash-command carrier — the measurement is taken; one interactive step remains

Task 2 of the hooks plan. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md at line 604 — that file is the authority, and this item tracks state only.

THE MEASUREMENT WAS TAKEN 2026-08-22 and is recorded in `reports/probes/2026-08-20-clear-and-prompt-hooks.md` §3. A slash command fires TWO events carrying `session_id` -- `UserPromptExpansion`, with `command_name`, `command_args` and `command_source` already parsed, and then `UserPromptSubmit`, carrying the raw `/name args` as `prompt` -- while plain typed text fires only the second, which is what makes a slash command distinguishable. The plan section marks this task "ANSWERED, one step short of done" -- only its Step 2, the interactive run, is unrun.
