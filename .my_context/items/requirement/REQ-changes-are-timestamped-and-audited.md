---
id: REQ-changes-are-timestamped-and-audited
type: requirement
title: Every change is timestamped, and operations are auditable
status: active
severity: hard
always: false
scope:
  - src/core/item.ts
  - src/core/rebuild.ts
  - src/core/mutate.ts
  - src/cli/**
tags:
  - audit
  - schema
  - roadmap
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: c96d82130a92ad1c
kind: non_functional
---

# Every change is timestamped, and operations are auditable

Items carry `created_at` and `updated_at` in frontmatter. Separately, an append-only
operation log records everything my_context does at RUN TIME — items created,
updated, superseded; what was injected into which session and tier; focus changes;
ingests; rebuilds — and it must be displayable, queryable and searchable through
commands and MCP tools.

This is auditing for people USING my_context, not for people developing it. Git is a
development-time artifact and must NOT be relied on: a user may never commit
.my_context/, may not be in a git repository at all, and most operations are not file
diffs in the first place. The log stands alone.

## Observations
- [rule] Do not rely on git for operations auditing. It is complementary at development time and absent in ordinary use
- [fact] The index has an updated_at column but it is worthless for audit — the index is disposable and resets on every rebuild. Durable records must live outside it
- [decision] The log is an append-only JSONL under .my_context/, external to items and excluded from every checksum — human-readable, corruption-resistant, trivially rotated
- [decision] The JSONL is authoritative and any query structure over it is derived and rebuildable — the same relationship Markdown has to the item index, so the project has one story about durability rather than two
- [requirement] Query surface: recent operations by default, with filters for time range, item id, session, operation kind and actor; tabular by default, JSON where the shape is hierarchical; mirrored as MCP tools so Claude can inspect its own effects
- [rule] updated_at MUST NOT be stamped by writeItem. The project asserts files → DB → files is byte-identical, and a rebuild calls writeItem — restamping there would rewrite every file on every rebuild and break the guarantee that makes the index disposable. Stamp at the mutation boundary instead
- [rule] Timestamps are excluded from computeItemChecksum, like `checksum` itself — otherwise touching a timestamp invalidates the item it describes
- [rule] UTC ISO-8601, never local time: items travel between machines and are read on both
- [rule] select stays pure and must never read a clock. Every timestamp is stamped at a write boundary and passed in
- [edge_case] The `origin` field records human/agent/ingest at creation but says nothing about later edits; the log is what carries the actor over time
- [edge_case] The ledger currently lives inside the disposable index, so deleting or self-healing that file destroys the injection history. Anything the audit must retain has to be written to the log, not left in the ledger alone

## Relations
- constrains [[INV-markdown-is-the-source-of-truth]]
