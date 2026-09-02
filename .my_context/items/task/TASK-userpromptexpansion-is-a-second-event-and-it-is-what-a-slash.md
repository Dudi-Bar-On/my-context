---
id: TASK-userpromptexpansion-is-a-second-event-and-it-is-what-a-slash
type: task
title: UserPromptExpansion is a second event, and it is what a slash command actually announces
status: active
severity: soft
always: false
summary: A typed shortcut command announces itself in a way ordinary text does not, so telling them apart is far cheaper than expected.
summary_of: 6ac4a552951fa5e9
scope: []
tags:
  - "plan:hooks"
  - "seq:2b"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 76fffdc723ebf13d
plan: hooks
seq: 2b
state: done
priority: "1"
---

# UserPromptExpansion is a second event, and it is what a slash command actually announces

Measured by the clear probe. Task 2's row 1 applies, minus its stated cost.

A slash command fires TWO events, both carrying session_id: UserPromptExpansion first - with expansion_type, command_name, command_args and command_source, measured as mycontext:status and plugin on this project's own commands - then UserPromptSubmit with the raw '/name args'. They share one prompt_id. Plain typed text fires only the second.

So a slash command is distinguishable from typed text without a sentinel line and without a hook on every prompt, which is what row 1 was thought to cost.

Two negatives worth keeping: UserPromptSubmit.source is declared in the schema but emitted as a constant-folded false - it is not on the wire, so nothing may be built on it. And SubagentStart/SubagentStop registered with no matcher stayed silent, which is a measured silence rather than an assumption.
