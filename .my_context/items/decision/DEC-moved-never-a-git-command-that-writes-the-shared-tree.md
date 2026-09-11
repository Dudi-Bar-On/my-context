---
id: DEC-moved-never-a-git-command-that-writes-the-shared-tree
type: decision
title: a lane runs no git command that writes the shared working tree — moved into the product rule store
status: active
severity: soft
always: false
summary: This rule now lives in the tool itself rather than in this project's notes, and this record says where to read it.
summary_of: 805a3292db2a43a5
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: fdddc3f4be542021
---

# a lane runs no git command that writes the shared working tree — moved into the product rule store

This rule is no longer maintained in this corpus. It is now the product rule store entry
`never-a-git-command-that-writes-the-shared-tree`, at `src/rules/entries/never-a-git-command-that-writes-the-shared-tree.md`, which ships
inside the package and is delivered at every door an agent starts through.

Read it with `mycontext rules show never-a-git-command-that-writes-the-shared-tree`.

It was retired here rather than copied, because a copy cannot be superseded and only the
original can — the finding `CLAUDE.md` opens with, measured on 2026-09-07 when five
superseded instructions were being acted on as current.

## Observations
- [supersession] Replaces RULE-a-delegated-worker-runs-no-git-command-that-touches-the: it moved into the product rule store as `never-a-git-command-that-writes-the-shared-tree` — read it with `mycontext rules show never-a-git-command-that-writes-the-shared-tree`. One copy, not two: a copy cannot be superseded and only the original can.

## Relations
- supersedes [[RULE-a-delegated-worker-runs-no-git-command-that-touches-the]]
