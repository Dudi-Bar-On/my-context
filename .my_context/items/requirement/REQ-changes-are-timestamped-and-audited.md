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
checksum: 59f44c58db98770f
kind: non_functional
---

# Every change is timestamped, and operations are auditable

Items carry `created_at` and `updated_at` in frontmatter — durable, visible in a git
diff, and surviving the rebuild that wipes the index. Separately, an append-only
operation log records what git cannot see: what was injected into which session,
what an agent created or superseded, focus changes, and ingests.

## Observations
- [fact] The index has an updated_at column but it is worthless for audit — the index is disposable and resets on every rebuild. Durable timestamps must live in the Markdown
- [fact] Git is already the audit trail for item CONTENT: git log --follow on an item file gives who, when and exactly what changed. The log records that an operation happened; git shows what it did
- [fact] The ledger already logs injection (session, item, tier, injected_at). Extending that pattern to mutations is the natural shape
- [rule] updated_at MUST NOT be stamped by writeItem. The project asserts files → DB → files is byte-identical, and a rebuild calls writeItem — restamping there would rewrite every file on every rebuild and break the guarantee that makes the index disposable. Stamp at the mutation boundary instead
- [rule] Timestamps are excluded from computeItemChecksum, like `checksum` itself — otherwise touching a timestamp invalidates the item it describes
- [rule] UTC ISO-8601, never local time: items travel between machines and are read on both
- [rule] select stays pure and must never read a clock. Every timestamp is stamped at a write boundary and passed in
- [decision] The operation log is an append-only JSONL under .my_context/ — human-readable, corruption-resistant, trivially rotated, and gitignored by default since it is a local operational record rather than shared knowledge
- [edge_case] The `origin` field records human/agent/ingest at creation but says nothing about later edits; the log is what carries the actor over time

## Relations
- constrains [[INV-markdown-is-the-source-of-truth]]
