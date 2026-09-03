---
id: ADR-build-rather-than-adopt
type: adr
title: Build my_context rather than adopting claude-mem or Basic Memory
status: active
severity: soft
always: false
summary: Two existing tools were weighed and neither pushes rules into a conversation unasked, and that pushing is the only reason this one was written.
summary_of: 9757741593bd5c5c
scope: []
tags:
  - architecture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 3a99596765a32878
---

# Build my_context rather than adopting claude-mem or Basic Memory

Context: both tools already store project knowledge and were evaluated seriously.

Decision: build. claude-mem is descriptive — it auto-summarizes activity into an
append-only log with no relations, no lifecycle and no authored items. Basic Memory
has the storage half right (Markdown + SQLite + MCP) but never injects: retrieval is
pull-only, so the model must choose to ask.

Consequence: the storage format is borrowed from Basic Memory for Obsidian and git
compatibility; the injection layer is what my_context adds and is the reason it exists.

## Observations
- [driver] An auto-summarizer cannot produce an invariant you intend to enforce
- [driver] Retrieval that depends on the model asking will not fire when the model does not know to ask
