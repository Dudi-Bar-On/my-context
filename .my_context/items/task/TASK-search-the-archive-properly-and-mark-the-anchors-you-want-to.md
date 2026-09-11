---
id: TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to
type: task
title: search the archive properly, and mark the anchors you want to come back to
status: active
severity: soft
always: false
summary: Real search across every recorded session and a way to mark the points you want to find again — the index and the anchors have landed, the viewer half has not.
summary_of: 88a4e63114acd55e
summary_was:
  - 2026-09-11 Real search across every recorded session, and a way to mark the points you want to find again.
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
checksum: decc2582ba781ca0
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

PART OF THIS HAS LANDED, 2026-09-11, AND THE ITEM STAYS `todo` FOR THE REST. Recorded here
rather than left to a commit message, because an item whose code is shipped and whose state
still says todo is how `plan:budget seq:16` sat for four days — and it is the same "reads as
never built" failure `plan:archive seq:9` is the precedent for.

DONE, on master in commit c7bcaa1b:
  Task 1  the FTS5 index over the archive’s prose   `src/core/conversation-search.ts`
  Task 3  the anchors table                        `src/core/anchors.ts`
The tokenizer was chosen by MEASUREMENT and the measurement is the reason: `unicode61`
returns NOTHING for a Hebrew stem inside a prefixed form (0 hits where trigram finds 14),
because Hebrew glues its one-letter particles onto the front of the word. It indexes lanes
as well as sessions — 298 lanes against 2 sessions here, so a session-only index would have
searched under 1% of the archive and looked like it worked.

NOT DONE, and this is what keeps the item open:
  Task 2  the viewer’s search uses it
  Task 4  anchors set two ways (CLI, viewer, both string tables)
  Task 5  the scope controls
All three touch `src/ui/**` and `e2e/**`, and were held because a browser lane held Playwright.

AND NOTHING CALLS `buildSearchIndex` YET. `conversation_prose` exists and is EMPTY, which
answers nothing rather than answering wrongly. Wiring it puts a new per-turn cost on the Stop
hook and that is a measurement Task 2 should take: cold fill of the whole corpus is 9.3s,
steady state is a tail.
