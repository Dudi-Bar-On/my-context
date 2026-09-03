---
id: NOGOAL-no-agent-hard-delete
type: non_goal
title: Agents never get a hard-delete tool
status: active
severity: hard
always: false
summary: Only a person may permanently remove something; an assistant can retire it and no more, so nothing that prevents a bug can vanish without anyone seeing.
summary_of: 300cb0fd47f0fc1e
scope:
  - src/mcp/**
tags:
  - scope
  - safety
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: c01d24847aaa9668
---

# Agents never get a hard-delete tool

Deletion is the user’s alone. Agents may supersede or deprecate — both reversible,
both leaving a trail. An agent able to hard-delete a constraint could silently remove
the thing preventing a bug, and nobody would see it happen.

## Observations
- [rule] The MCP surface in Plan 3 exposes no delete_item
