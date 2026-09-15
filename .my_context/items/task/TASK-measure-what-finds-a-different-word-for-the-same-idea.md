---
id: TASK-measure-what-finds-a-different-word-for-the-same-idea
type: task
title: measure what finds a different word for the same idea without taking a model
status: active
severity: soft
always: false
summary: Before deciding whether searching by meaning is worth a dependency, find out how much of it we can get for nothing.
summary_of: 399161163c25786b
scope:
  - src/core/search.ts
  - src/core/conversation-search.ts
tags:
  - v2
  - search
  - "plan:semantic"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 099750a9f8d726fa
plan: semantic
seq: "1"
state: done
priority: "2"
---

# measure what finds a different word for the same idea without taking a model

D77, first step, and it is deliberately NOT "add semantic search".

THE COSTS ARE ALREADY MEASURED AND RECORDED IN THE D77 ROW OF THE REGISTER. In short: the index
is a non-problem (11,692 vectors; brute-force cosine 4.3 ms at 384 dimensions, 9.3 at 768, 27.2
at 1536, no dependency); sqlite-vec IS loadable by node:sqlite on Node 24.14.0 — loadExtension
and allowExtension both verified — but it is a per-platform COMPILED BINARY and therefore a
runtime dependency, and it solves the half that is already free; and the real cost is THE MODEL,
which either ships as a large dependency or sends the owner’s transcripts to a third party.

SO THIS TASK IS THE CHEAP HALF, AND IT IS UNMEASURED. How much of "a different word for the same
idea" can be had with NO model at all? Candidates, each to be measured against real failed
searches rather than argued:
  — an alias / synonym table THE OWNER CONTROLS, which is corpus data and not a derivation;
  — stemming or prefix matching on top of the existing FTS5 trigram index;
  — the corpus’s OWN relation graph and tag vocabulary as query expansion — the items already
    say what relates to what, and nothing uses that at search time;
  — matching an item’s title and summary as well as its body, weighted.

THE MEASUREMENT THAT DECIDES IT: a set of real queries that FAIL today. Without those this is
taste. Start by collecting them — the audit log and the archive both hold real searches.

ONLY IF THAT FLOOR IS TOO LOW does a model become the question, and then it is an owner ruling
with the numbers in front of him, not a decision made inside a feature.

HEBREW IS NOT OPTIONAL HERE. The index is FTS5 TRIGRAM and not unicode61 precisely because
Hebrew glues particles onto word fronts. Any expansion scheme that assumes English word
boundaries will be worse than what exists, and must be measured on Hebrew before it is offered.
