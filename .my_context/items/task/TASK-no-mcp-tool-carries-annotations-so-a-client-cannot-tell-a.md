---
id: TASK-no-mcp-tool-carries-annotations-so-a-client-cannot-tell-a
type: task
title: no MCP tool carries annotations, so a client cannot tell a read from a retirement without parsing English
status: active
severity: soft
always: false
summary: Nothing in the machine-readable description says which operations only read and which change or destroy things, so a host cannot warn before a damaging one.
summary_of: aa63ac7e7b8047c8
scope:
  - src/mcp/tools.ts
tags:
  - v2
  - mcp
  - annotations
  - "plan:mcpsurface"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: f14fb520eacd2091
plan: mcpsurface
seq: "2"
state: done
priority: "2"
---

# no MCP tool carries annotations, so a client cannot tell a read from a retirement without parsing English

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, M2) as row 62 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. No MCP tool carries `annotations`. A client therefore cannot tell `get_item` from `supersede_item` without parsing English prose.

WHY IT IS SHARPER HERE THAN ELSEWHERE. This product has thought harder than most about which acts are approval-worthy -- the whole lifecycle, the gates, the confirm copy, the refusal vocabulary -- and has made NONE of it machine-readable on the surface a machine reads. `readOnlyHint` and `destructiveHint` are exactly the fields that reasoning already fills.

THE CONSEQUENCE. A host cannot offer a safe read-only mode, and cannot raise a confirmation only where one is warranted, because it has no way to know which tools write.
