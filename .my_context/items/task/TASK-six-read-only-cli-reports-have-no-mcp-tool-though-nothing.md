---
id: TASK-six-read-only-cli-reports-have-no-mcp-tool-though-nothing
type: task
title: six read-only CLI reports have no MCP tool, though nothing blocks any of them
status: active
severity: soft
always: false
summary: Six read-only commands have no tool counterpart, so an agent can reach those views only by shelling out to the terminal.
summary_of: b1f13234bdf4e4ab
scope:
  - src/mcp/tools.ts
  - src/plugin/parity.ts
  - src/core/decay.ts
  - src/ingest/session.ts
  - src/lesson/derive.ts
  - src/cli/commands/status.ts
  - src/cli/commands/todo.ts
tags:
  - v2
  - mcp
  - tools
  - "plan:mcp"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: a45f52bb28d89dd8
plan: mcp
seq: "4"
state: todo
priority: "2"
---

# six read-only CLI reports have no MCP tool, though nothing blocks any of them

Build one read-only MCP tool per command, all six the same shape as the existing read tools (`query_items`, `list_drafts`) — no mutation, no origin field, each wrapping the function the CLI command itself already calls, per `CLI_WITHOUT_TOOL`'s own citations (src/plugin/parity.ts):

- decay: `computeDecay` (core/decay.ts).
- ingest-status: `listSessions`/`pendingAnchors` (ingest/session.ts).
- lesson-stage: `stageRuleCandidates` (lesson/derive.ts) — stages candidates on disk, creates no item.
- pack: the preview-only import-command printer `CLI_WITHOUT_SLASH.pack` already calls 'deliberate future work' — this tool stops at the same point, printing the import command for a person to run rather than importing anything itself.
- status: the composed dashboard `cli/commands/status.ts` builds from `runChecks`, `computeDecay`, `listSessions` and the review queue.
- todo: `filterItems` over todos/notes (cli/commands/todo.ts).

Name each tool to match the existing naming convention (verb_noun, e.g. `list_drafts`, `audit_log`) rather than the bare CLI verb, register each in `SPECS` (src/mcp/tools.ts) with a description in `src/help/topics/capture.md`, add a `TOOL_PARITY` row for each, and delete each command's entry from `CLI_WITHOUT_TOOL` (src/plugin/parity.ts) as it lands — `test/plugin/parity.test.ts` fails on any entry that goes stale in either direction, so a partial landing is visible rather than silent.
