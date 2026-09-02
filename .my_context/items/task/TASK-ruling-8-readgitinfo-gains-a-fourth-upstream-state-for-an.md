---
id: TASK-ruling-8-readgitinfo-gains-a-fourth-upstream-state-for-an
type: task
title: "ruling 8: readGitInfo gains a fourth upstream state for an unreadable local tip"
status: active
severity: soft
always: false
summary: When the local version cannot be read at all, stop claiming it differs from the shared one and say it is unknown.
summary_of: eeb68d832e7a30f8
scope: []
tags:
  - "plan:rulings"
  - "seq:9"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 331286ec82a30665
plan: rulings
seq: "9"
state: done
progress: "100"
priority: "2"
source: src/ui/git-info.ts — shipped with ruling B3, gitinfo-disclose
last_change: "2026-08-20T22:21:23Z"
---

# ruling 8: readGitInfo gains a fourth upstream state for an unreadable local tip

Depends on the mockup carrying its string. Today returns 'differs' when the local tip cannot be read and the upstream can, so the strip would claim 'differs from origin/main' - a claim about the repository the reader cannot make.
