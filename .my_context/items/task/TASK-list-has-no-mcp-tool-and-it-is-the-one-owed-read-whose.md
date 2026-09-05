---
id: TASK-list-has-no-mcp-tool-and-it-is-the-one-owed-read-whose
type: task
title: list has no MCP tool, and it is the one owed read whose relationship to query_items has never been decided
status: active
severity: soft
always: false
summary: The corpus listing command has no tool, and nobody has decided whether it should get one or simply point callers at the query tool instead.
summary_of: 26f3e01e7c3e9818
scope:
  - src/mcp/tools.ts
  - src/plugin/parity.ts
  - src/cli/index.ts
tags:
  - v2
  - mcp
  - tools
  - "plan:mcp"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: bc89ef35abd16896
plan: mcp
seq: "5"
state: done
priority: "3"
verified_on: 2026-09-05
---

# list has no MCP tool, and it is the one owed read whose relationship to query_items has never been decided

Build a read-only `list`-equivalent MCP tool the same way this plan's other owed reads are built (see seq 4) — wrapping `cmdList` (cli/index.ts), no mutation, no origin check.

`CLI_WITHOUT_TOOL.list` (src/plugin/parity.ts) names the open point directly: 'nothing has decided whether query_items already answers it well enough to make a second tool redundant.' Do not let that stall the build — the owner has approved the tool — but settle it as part of the work: compare `cmdList`'s grouped-by-category output against what a `query_items` call already returns, and write the new tool's description to say plainly when a caller should reach for this tool instead of `query_items` (or, if the two turn out to answer the same question, say so in the description rather than ship two tools that silently duplicate one route).

Add the `TOOL_PARITY` row and delete `CLI_WITHOUT_TOOL.list` in the same change.
