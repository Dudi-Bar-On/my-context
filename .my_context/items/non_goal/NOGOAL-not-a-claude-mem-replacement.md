---
id: NOGOAL-not-a-claude-mem-replacement
type: non_goal
title: my_context does not replace claude-mem
status: active
severity: hard
always: true
summary: This tool holds the rules a project must follow, not a memory of what happened — it never watches your work or searches your history.
summary_of: c37e33923d66a84f
scope: []
tags:
  - scope
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 82f3be0f72290bcf
---

# my_context does not replace claude-mem

claude-mem is descriptive — it auto-summarizes what happened. my_context is
normative — what must hold. That line survived this product growing a
continuity tier and an audit log, so it is redrawn here rather than deleted.

STILL REFUSED, and each is concrete:
- No retrieval over past work. No semantic search, no index of transcripts,
  diffs or conversations, no "what did we do about X last month".
- No automatic capture of activity. Nothing turns a session, a turn or a
  commit into an item. An item is authored by a person, or staged as a DRAFT
  by an agent and inert until a person promotes it.
- No transcript store. The audit log records ids, tiers and token cost —
  never the text of an item and never the text of a session.

WHAT IS BUILT, AND WHY IT IS THE OTHER SIDE OF THE LINE. The continuity tier
carries a pointer plus a bounded digest of the handover into the next
session, and SessionStart hands a compacted session the handover the last one
left. A hook cannot write a handover — only the model can, and it writes it
because it was ASKED, once, at a measured threshold. So the handover is
AUTHORED, never observed. The audit log is a record of THIS PRODUCT'S OWN
ACTS: what it injected, into which session, at which tier, at what cost. It
answers "what was this corpus shown", not "what happened in this repository".

THE TEST, when a new feature is unsure which side it is on: does it derive
its content from the user's work without being asked? Then it is claude-mem's,
and it does not get built here.

## Observations
- [boundary] An auto-summarizer cannot produce an invariant you intend to enforce
- [boundary] Not a general knowledge base, and not a documentation site generator

## Relations
- derived_from [[ADR-build-rather-than-adopt]]
