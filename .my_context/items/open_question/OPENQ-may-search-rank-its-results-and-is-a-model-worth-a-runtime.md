---
id: OPENQ-may-search-rank-its-results-and-is-a-model-worth-a-runtime
type: open_question
title: may search RANK its results, and is a model worth a runtime dependency to find a different word for the same idea?
status: superseded
severity: soft
always: false
summary: Should searching put the best matches first, and is it worth adding a large piece of third-party software to make it understand synonyms?
summary_of: ac2da4e6abb58438
scope: []
tags:
  - v2
  - search
  - semantic
  - proposed
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: 2026-09-16
checksum: fc20b0d0ae120413
blocks: semantic/2
---

# may search RANK its results, and is a model worth a runtime dependency to find a different word for the same idea?

D77 WAS MINTED 2026-09-15 WITH ITS MEASUREMENTS AND WITHOUT THIS ANSWER, and `semantic/1`
ends in it. Carried to the owner in the handover of 2026-09-16 as one of the three decisions no
command could surface; `semantic/2` cannot choose which three features to ship first without it.

THE FIRST HALF: MAY SEARCH RANK. `filterItems` REFUSES TO RANK on purpose today. `semantic/2`'s
own item calls that "the real gate: every feature is useless without it" — AND/OR/NOT, prefix,
phrase and NEAR all exist in FTS5 already and all of them return a pile rather than an answer.
Turning ranking on is a change to what a result LIST MEANS, which is why it is his and not a lane's.

THE SECOND HALF: IS A MODEL WORTH A DEPENDENCY. D77's row carries the numbers so the decision is
made against them rather than against instinct:
  - THE INDEX IS A NON-PROBLEM. 11,692 vectors; brute-force cosine in plain JS is 4.3 ms per query
    at 384 dimensions. An ANN index earns its keep at millions.
  - SQLITE-VEC LOADS ON NODE 24 AND IS STILL WRONG HERE: a per-platform COMPILED BINARY against
    `CONST-zero-runtime-dependencies`, which is hard — and it solves the half that is already free.
  - THE REAL COST IS THE MODEL. Anthropic ships no embeddings endpoint, so it is a local model (a
    large dependency) or sending his transcripts to a third party, which collides with his own
    standing rule that the conversation content is his property.

SO THE CHEAPEST THINGS ARE IN SCOPE FIRST AND ARE NOT YET MEASURED — a synonym table he controls,
stemming, and the corpus's own relation graph and tag vocabulary as query expansion. A model is the
LAST resort here, not the first, and taking one is his ruling with those costs in front of him
rather than a decision made inside a feature.

## Relations
- superseded_by [[RULE-search-may-rank-its-results-and-the-model-it-asks-is-the]]
