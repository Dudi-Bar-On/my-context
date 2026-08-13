---
id: NOGOAL-not-a-claude-mem-replacement
type: non_goal
title: my_context does not replace claude-mem
status: active
severity: hard
always: true
scope: []
tags:
  - scope
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 62fbe6baa4b1fcba
---

# my_context does not replace claude-mem

claude-mem is descriptive — it auto-summarizes what happened. my_context is
normative — what must hold. Do not build session history, activity capture, or
semantic search over past work; that is claude-mem’s job and it already does it.

## Observations
- [boundary] An auto-summarizer cannot produce an invariant you intend to enforce
- [boundary] Not a general knowledge base, and not a documentation site generator

## Relations
- derived_from [[ADR-build-rather-than-adopt]]
