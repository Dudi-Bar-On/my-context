---
id: TASK-the-audit-log-records-that-a-subagent-ran-and-its-id-never
type: task
title: the audit log records that a subagent ran and its id, never what it was dispatched to do
status: active
severity: soft
always: false
summary: A dispatched subagent is recorded by id alone, so the log cannot say what any lane was for, only that one ran and later stopped.
summary_of: d364d4fb38df9d52
scope:
  - hooks/hooks.json
  - src/hooks/post-tool-use.ts
  - src/core/audit.ts
tags:
  - v2
  - hooks
  - audit
  - "plan:hooks"
  - "seq:24"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 2905adc56933a540
plan: hooks
seq: "24"
state: done
priority: "2"
verified_on: 2026-09-04
---

# the audit log records that a subagent ran and its id, never what it was dispatched to do

Two rows already exist for every dispatched agent: an injection row at subagent-start and a hook
row at subagent-stop, both carrying the agent id. Neither carries the title. So the log answers
"a lane ran and finished" and cannot answer "what for", which is the only question a reader has
weeks later.

The missing half is already reachable and was measured rather than guessed. The title arrives as
tool_input.description on the Agent tool, and tool_response.agentId sits on that same payload, so
one PostToolUse firing carries both halves with no file reads at all. Coverage was measured at
100 percent across 541 real dispatches, median length 29 characters. The reason nothing captures
it today is narrow: the PostToolUse matcher in hooks/hooks.json reads Write|Edit|MultiEdit, so
the Agent tool never fires the hook and the description is discarded.

What to build: widen that matcher to include Agent and nothing else, and record ONE row per
dispatch carrying the agent type, the description and the id. Keep the id as well as the title,
because the id is what joins this row to the subagent-stop row already written and titles are not
unique. A payload arriving without a description must still record the id rather than dropping
the row, per INV-nothing-is-dropped-silently, and nothing on this path may throw, per
INV-hooks-fail-open, since it now runs on a very common tool.

One row per dispatch is the ruling and the boundary. Recording each subagent tool call would
reconstruct the live progress line a terminal shows, but a single lane made 151 tool calls in one
session, so a six-lane wave would write roughly nine hundred rows. That is the per-message noise
this corpus already carried once and deleted, 5,207 rows of it, and the argument against
repeating it is recorded in ui-server-upkeep.ts.

Two adjacent measurements are worth confirming while in this code, and reporting rather than
fixing: 96.7 percent of subagent-stop rows carry an absent type, and SubagentStop delivers an
undeclared last_assistant_message field.
