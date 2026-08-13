---
id: REQ-cli-output-is-tabular-with-detail-levels
type: requirement
title: Human-facing output is tabular, with selectable detail levels
status: active
severity: hard
always: false
scope:
  - src/cli/**
  - src/core/render*.ts
tags:
  - cli
  - usability
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 3aeaa8471fee035a
kind: non_functional
---

# Human-facing output is tabular, with selectable detail levels

`status`, `list`, `query`, `doctor` and the decay/report commands must print aligned
tables with meaningful columns — a per-invocation sequence number, id, title, type,
status, and whatever else the command is about — not the ad-hoc line output Plan 1
shipped. Every such command takes a detail level: `summary` (counts and totals only),
`short` (one row per item, the default), and `full` (all fields, bodies included).

## Observations
- [limit] Zero runtime dependencies still binds: no cli-table3, no chalk. The table renderer is hand-written and belongs in one module every command shares
- [rule] The sequence number is presentation only, scoped to one invocation. The id is the identity — never let a sequence number be used to address an item
- [rule] Detect a TTY. When stdout is piped, emit machine-readable output rather than box-drawing characters; a `--json` flag should be available on every reporting command
- [rule] Choose the shape by the data, not by the audience: tables for flat lists, JSON for hierarchy. An item with its relations, a supersession chain, or doctor findings grouped by check do not flatten into rows without losing the structure that makes them worth reading
- [rule] Where hierarchy is the point, JSON is the human format too — not merely the scripting escape hatch. An indented tree is an acceptable alternative for a TTY, but never a table with a repeated parent column
- [edge_case] process.stdout.columns is undefined when piped or redirected — pick a fixed default width rather than crashing or emitting unbounded lines
- [edge_case] Legacy Windows consoles render Unicode box-drawing poorly; an ASCII fallback keeps output readable there
- [rule] Truncate long values to fit a column with an ellipsis rather than wrapping mid-word, and never truncate an id

## Relations
- constrains [[STD-error-message-conventions]]
