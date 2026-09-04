---
id: TASK-lesson-and-procedure-have-no-mcp-tool-and-each-needs-a-shape
type: task
title: lesson and procedure have no MCP tool, and each needs a shape decision plain wrapping would miss
status: active
severity: soft
always: false
summary: Two more commands have no tool, and each carries a nuance about attribution or about which half is safe to expose that a bare wrapper would get wrong.
summary_of: ffbf96f858adbcf1
scope:
  - src/mcp/tools.ts
  - src/plugin/parity.ts
  - src/cli/commands/lesson.ts
  - src/cli/commands/procedure.ts
tags:
  - v2
  - mcp
  - tools
  - "plan:mcp"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 0392f9ddf244335a
plan: mcp
seq: "6"
state: todo
priority: "2"
---

# lesson and procedure have no MCP tool, and each needs a shape decision plain wrapping would miss

Build two tools, grouped here because each departs from the plain read-only shape the rest of the owed set uses:

**lesson.** `mycontext lesson --agent` already records `origin: 'agent'` on purpose (cli/commands/lesson.ts) — the trust boundary is already solved, the same way `create_item` solves it. Build the tool to always record `origin: 'agent'`, never plain human origin, since a tool call is a non-human caller by construction; there is no flag-equivalent decision to make here, only the wiring.

**procedure.** `mycontext procedure` is a mixed command: `list`/`show`/`step` are plain reads, but `activate` and `done` (cli/commands/procedure.ts) hardcode `origin: 'human'` on their `updateItem` calls and must stay a human-only act — the same reasoning that gives `review` a read tool (`list_drafts`) with no tool for `review promote`. Build a read-only tool over `list`/`show`/`step` only; do not expose `activate`/`done` through it.

For both: register in `SPECS` (src/mcp/tools.ts) with descriptions in `src/help/topics/capture.md`, add `TOOL_PARITY` rows, and delete both entries from `CLI_WITHOUT_TOOL` (src/plugin/parity.ts) once landed.
