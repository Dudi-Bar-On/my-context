---
id: TASK-write-the-tutorials-the-manifest-names-with-no-existing
type: task
title: write the tutorials the manifest names with no existing chapter
status: active
severity: soft
always: false
summary: The tutorials the manifest names with no matching chapter today are written new, each against a real feature rather than a repository file.
summary_of: 52612248733af264
acknowledged:
  - dead_scope@0ef094301bd11e3b
scope:
  - docs/tutorials/**
tags:
  - v2
  - tutorials
  - docs
  - "plan:tuts"
  - "seq:7"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: f46a1d144c786c83
plan: tuts
seq: "7"
state: todo
priority: "2"
needs: tuts/1
---

# write the tutorials the manifest names with no existing chapter

Content task, filed alongside tuts/5 rather than inside it, because its size depends on the manifest tuts/1 freezes -- the roster names features (search and query, packs, sessions and continuity, linking and relations, and others the worked example in the spec does not exhaustively list) that docs/TUTORIAL.md and docs/TUTORIAL-ADVANCED.md never covered.

Each new file follows the same required shape as a migrated one: what it is for, how it works, how to use it from the CLI, how to use it from the UI, with the two surfaces named for what each can and cannot do. Every worked command block is run against a fresh workspace before it is checked in, the same discipline tuts/5 carries forward. The owner has said this content may be revised again once v2.0 is complete, so this task is about coverage existing, not about the prose being final.
