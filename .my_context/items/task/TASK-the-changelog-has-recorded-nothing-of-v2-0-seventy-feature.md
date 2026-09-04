---
id: TASK-the-changelog-has-recorded-nothing-of-v2-0-seventy-feature
type: task
title: "the CHANGELOG has recorded nothing of v2.0: seventy feature commits, zero entries"
status: active
severity: soft
always: false
summary: The list of what changed in this release is empty after seventy pieces of work, so nobody can judge how big the release is.
summary_of: 0e6ca0ea94ee0e75
scope: []
tags:
  - "plan:rulings"
  - "seq:40"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 7d9a6518a37d9e4d
plan: rulings
seq: "40"
state: done
priority: "1"
---

# the CHANGELOG has recorded nothing of v2.0: seventy feature commits, zero entries

Found by export task 16, which correctly refused to patch one entry into it.

The Unreleased section describes 'one config key added, one rule enforced, and four fixes - five of the six change something you will see'. That prose counts its own entries, so adding a single entry falsifies it. It is not wrong today; it is describing a section that stopped being the whole story seventy feature commits ago.

Measured on master: git log v1.0.2..master finds 70 commits starting feat. Zero mentions of pack import, --as-pack, mycontext export, procedure or session name anywhere in CHANGELOG.md.

What has shipped since 1.0.2 and is unrecorded includes six new CLI commands - procedure, export, pack, session, plus init --pack and review promote --all --pack - the entire web UI read surface with its security gate, SubagentStart registration, the session-name store, the carry mechanism, and the dark-glass repaint of the mockup.

This is a release blocker, not a documentation nicety: VERSIONING.md decides what a change is worth from what the CHANGELOG says it is, and a MINOR-vs-MAJOR call cannot be made from an empty section. Whoever writes it must also rewrite the counting sentence, or drop the count.
