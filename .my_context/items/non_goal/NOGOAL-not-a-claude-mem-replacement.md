---
id: NOGOAL-not-a-claude-mem-replacement
type: non_goal
title: my_context does not replace claude-mem
status: active
severity: hard
always: true
summary: This tool holds the rules a project must follow, not a memory of what happened — it never watches your work and never tells you what your history meant, though it can now find the words you yourself wrote in it.
summary_of: c296b4c2e122f071
summary_was:
  - 2026-09-15 This tool holds the rules a project must follow, not a memory of what happened — it never watches your work or searches your history.
scope: []
tags:
  - scope
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: efc3160074d12d3e
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

── AMENDED 2026-09-15 BY THE OWNER, BECAUSE ONE CLAUSE HAD GONE FALSE ───────────

THE REFUSAL ABOVE SAID "no index of transcripts" AND THIS PRODUCT NOW SHIPS ONE. D37 built
the conversation archive and D42 built retrieval over it, both by his ruling, and this item
was never brought forward. It is pinned, hard and delivered every session, so for four days
it has been telling every assistant that a shipped feature does not exist.

That is the exact defect this project measures — a superseded instruction being acted on as
current — and it happened to the item whose own job is to draw the line. Recorded rather
than quietly rewritten.

WHAT NOW STANDS, clause by clause:

  — NO AUTOMATIC CAPTURE OF ACTIVITY. UNCHANGED AND STILL HARD. Nothing turns a session, a
    turn or a commit into an item. An item is authored by a person, or staged as a DRAFT by
    an agent and inert until a person promotes it. The test below is unchanged.

  — NO TRANSCRIPT STORE IN THE CORPUS. UNCHANGED. The audit log records ids, tiers and
    token cost — never the text of an item, never the text of a session.

  — "NO INDEX OF TRANSCRIPTS" IS WITHDRAWN, and it was already untrue. The archive indexes
    the owner’s OWN transcripts, on his own machine, gitignored, derived from files he
    already has, and deleting the index loses nothing. It never leaves the machine. That is
    the other side of the line from an auto-summariser that decides what your work MEANT.

  — "NO RETRIEVAL OVER PAST WORK" IS NARROWED TO ITS REAL SUBJECT. Lexical retrieval over
    his own archive is built and is his (D42). What stays refused is anything that DERIVES
    NEW CLAIMS from that archive without being asked — a summary of what happened, a
    "what did we do about X last month" answer composed by a model, an item minted from a
    conversation. Finding the bytes he wrote is retrieval; telling him what they meant is
    claude-mem’s.

  — SEMANTIC SEARCH REMAINS REFUSED, and now has a subject rather than a sentence: D77.
    It is refused TODAY for reasons that are measured, not doctrinal, and they are written
    down there so the decision can be re-made against them rather than re-argued.

THE TEST IS UNCHANGED AND IT IS STILL THE WHOLE ITEM: does the feature derive its content
from the user’s work WITHOUT BEING ASKED? Then it is claude-mem’s and it is not built here.
An index is not a derivation. A summary is.

## Observations
- [boundary] An auto-summarizer cannot produce an invariant you intend to enforce
- [boundary] Not a general knowledge base, and not a documentation site generator

## Relations
- derived_from [[ADR-build-rather-than-adopt]]
