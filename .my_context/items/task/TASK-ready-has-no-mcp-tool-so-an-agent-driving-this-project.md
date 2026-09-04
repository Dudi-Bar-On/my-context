---
id: TASK-ready-has-no-mcp-tool-so-an-agent-driving-this-project
type: task
title: ready has no MCP tool, so an agent driving this project through tools cannot see what work is unblocked
status: active
severity: soft
always: false
summary: The read-only command that lists work ready to start has no tool counterpart, so an agent using only tools cannot see what is unblocked.
summary_of: 380ebb9ddd836789
scope:
  - src/mcp/tools.ts
  - src/plugin/parity.ts
  - src/help/topics/capture.md
tags:
  - v2
  - mcp
  - tools
  - "plan:mcp"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 3b038b81b1f3c608
plan: mcp
seq: "1"
state: done
priority: "1"
verified_on: 2026-09-04
---

# ready has no MCP tool, so an agent driving this project through tools cannot see what work is unblocked

Build a `ready` MCP tool wrapping the same read-only computation `mycontext ready` uses (the needs/readiness logic in `core/needs.ts` and `cli/commands/ready.ts`). No mutation and no origin check are needed — `CLI_WITHOUT_TOOL.ready` (src/plugin/parity.ts) already records the disposition as 'owed' for exactly that reason.

Shape it the way the existing read tools are shaped (`query_items`, `list_drafts`): a JSON schema exposing the CLI's own filters — `plan`, `held`, `limit` — register it in the `SPECS` array in `src/mcp/tools.ts`, and add its description to `src/help/topics/capture.md` (`createRegistry` throws if a spec has no matching description there).

Add a `TOOL_PARITY` row for it (`src/plugin/parity.ts`) once it lands, and delete the `ready` entry from `CLI_WITHOUT_TOOL` in the same change — that file's own comment names this as the expected way the entry stops being true, and `test/plugin/parity.test.ts` will fail on the stale entry rather than let it lag.
