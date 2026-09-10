---
id: TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to
type: task
title: search the archive properly, and mark the anchors you want to come back to
status: active
severity: soft
always: false
summary: Real search across every recorded session, and a way to mark the points you want to find again.
summary_of: 91da90c99c02355f
scope:
  - src/core/conversation-search.ts
  - src/core/anchors.ts
  - src/core/conversation-index.ts
  - src/ui/**
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: a3b6f1a87dbd488d
plan: recall
seq: "1"
state: todo
priority: "1"
---

# search the archive properly, and mark the anchors you want to come back to

D42 PHASE 1. Plan: docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md Tasks 1-5. Design: docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md sections 7, 11, 12.

WORTH HAVING EVEN IF NOTHING ELSE SHIPS: it improves the viewer he uses today, and everything else
in D42 stands on it.

FTS5 COSTS NOTHING. Node 24’s bundled SQLite 3.51.2 has ENABLE_FTS5, bm25(), porter and trigram -
verified including Hebrew - and `node:sqlite` is already imported in 14 files. No dependency, no
build step.

ANCHORS GET A TABLE, NOT A COLUMN, and plan:archive seq:34 proved why hours before this was
written: `upsert` sets every column from `excluded` and the Stop hook rebuilds every turn, so a
hand-typed value lives ONE TURN silently; and `removeMissing` deletes the whole row when the
harness prunes. Anchors carry id, timestamp, session and a BYTE offset - the corpus is Hebrew from
record 5, so character offsets are wrong.

A new table is a new schema version by this index’s own rule: an older index reports Incomplete
and heals on rebuild. Run the rebuild rather than leaving his server stale.

Anchors are set two ways: he marks one, and a table, a report or a ruling is marked automatically.
