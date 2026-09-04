---
id: TASK-doctor-has-no-mcp-tool-and-no-excuse-was-ever-recorded-for
type: task
title: doctor has no MCP tool, and no excuse was ever recorded for its absence
status: active
severity: soft
always: false
summary: The self-check that reports index drift, orphans and dead globs has no tool counterpart, so an agent cannot run it without shelling out.
summary_of: fe383bf3f8c2c894
scope:
  - src/mcp/tools.ts
  - src/plugin/parity.ts
  - src/doctor/checks.ts
tags:
  - v2
  - mcp
  - tools
  - doctor
  - "plan:mcp"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 90161f4efbf006db
plan: mcp
seq: "2"
state: done
priority: "1"
verified_on: 2026-09-04
---

# doctor has no MCP tool, and no excuse was ever recorded for its absence

Build a `doctor` MCP tool wrapping `runChecks` (`src/doctor/checks.ts`), the same function `cli/commands/status.ts` already composes. It is read-only end to end — no finding it produces mutates anything, and nothing on its path checks origin.

Follow the same construction as the `ready` tool (this plan's seq 1): register in `SPECS` (`src/mcp/tools.ts`) with a description in `src/help/topics/capture.md`, expose the report's shape (findings, level, code, item, remedy) rather than the CLI's table rendering, and decide whether `--full`/`--short`/`--summary`'s three verbosity levels need a matching parameter or whether the tool should simply return the full structured list and let the caller filter.

Add the `TOOL_PARITY` row and delete `CLI_WITHOUT_TOOL.doctor` in the same change — its own entry already anticipates this: 'another lane is adding it as a tool while this row is being written ... the day that lands, doctor drops out of the derived without list and this row fails the set-comparison test below until it is deleted'.
