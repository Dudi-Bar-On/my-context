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
checksum: 8ca23fd69bc1695f
kind: non_functional
---

# Every change is timestamped, and operations are auditable

**Status: the operation log is BUILT, and this requirement is met apart from one clause
named below.** `.my_context/.audit/audit.jsonl` is an append-only JSONL log written at the
mutation boundary and at every hook action; `mycontext audit` and the `audit_log` MCP tool
query it. Shipped 2026-08-16 (Phase 5, ROADMAP D4.3).

**What is recorded, per plan decision Q3: mutations and hook actions including injections
— and for an injection the SCOPE, not the content.** Every create, update, stage, promote,
discard, supersede, accept, refresh, link and unlink, with its origin, its item, the
fields it actually moved, and when. Every SessionStart and just-in-time injection, with
the ids and tiers delivered and what the budget spilled; the PreCompact snapshot; the
capture nudge; the write-deny. Never the injected text, so the log stays small and no
second copy of a governing item lives in a file no checksum covers.

The JSONL is authoritative; `.my_context/.audit/audit.db` is a derived SQLite projection
that is safe to delete and rebuilds on the next read — the same relationship Markdown has
to the item index. Records are excluded from computeItemChecksum and are never read during
rebuild or repair, so the byte-identical round trip is untouched.

**What is NOT met: items still carry no created_at or updated_at frontmatter fields.** The
log records when every change happened, so the operation history this item asks for exists
and is queryable — but a reader holding one item's Markdown still cannot see when it was
created or last changed without consulting the log. That gap is deliberate rather than
overlooked: stamping at writeItem would rewrite every file on every rebuild and break the
guarantee that makes the index disposable (see the observations), and stamping at the
mutation boundary is unbuilt work.

Git is not relied on: the log stands alone, and a user who never commits `.my_context/`,
or is not in a git repository at all, still has it. The converse limitation is disclosed
where the log is documented — it is gitignored, so it describes the machine that produced
it and is neither a backup nor a shared record.

Two observations below are now superseded by what shipped and are left in place because no
surface can edit an observation. The ledger STAYS, as a derived cache: it answers
seen(sessionId) on the hot path and decay is computed from its aggregates. It is no longer
the only record — every injection is written to the audit log first, and ledgerRows
replays the ledger from it — so "deleting the index destroys the injection history" is no
longer true.

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
