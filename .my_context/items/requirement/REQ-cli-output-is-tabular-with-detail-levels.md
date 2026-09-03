---
id: REQ-cli-output-is-tabular-with-detail-levels
type: requirement
title: Human-facing output is tabular, with selectable detail levels
status: active
severity: hard
always: false
summary: Everything printed for a person comes out as aligned tables at a detail level you pick, so it stays readable and looks the same on every machine.
summary_of: 595a439e71558e20
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
checksum: 36d7daaab521afb6
kind: non_functional
---

# Human-facing output is tabular, with selectable detail levels

**Status: built, apart from one clause — the per-invocation sequence number does not exist.**
No reporting command prints a sequence column; the tables address rows by id alone. Found by
the Phase 6 census (2026-08-16) running every reporting command; the clause stands
unimplemented rather than being quietly read out of the requirement, and it is small enough
to fix when a surface actually needs it. Everything else below is built and was verified by
execution: `status`, `list`, `query`, `doctor`, `decay`, `audit` and `ingest-status` print
aligned tables through one shared renderer (`src/cli/commands/format.ts`), each takes
`--summary`, `--short` (the default) and `--full`, and each takes `--json`.

**Two [rule] observations below are answered by a different design than they asked for, and
no surface can edit an observation, so they are corrected here.** Piped stdout is NOT
switched to machine-readable output: `--json` is the machine format on every reporting
command, and tables render at a constant width (`OUTPUT_WIDTH` = 100, `MYCONTEXT_WIDTH` as
the operator's override) precisely so a documented example is not a fact about the terminal
that generated it — `scripts/gen-doc-examples.ts` captures through a pipe and
`test/docs/examples.test.ts` replays it on every machine. Box-vs-ASCII is decided by the
terminal's own advertisements, failing toward ASCII on Windows, with `MYCONTEXT_ASCII=1` /
`MYCONTEXT_UNICODE=1` as overrides — so the legacy-console [edge_case] is met, just not by
TTY sniffing. And long values wrap at spaces rather than truncating with an ellipsis;
nothing is ever truncated, ids included, so the ellipsis rule's intent — no collisions, ids
survive — holds while its letter does not.

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
