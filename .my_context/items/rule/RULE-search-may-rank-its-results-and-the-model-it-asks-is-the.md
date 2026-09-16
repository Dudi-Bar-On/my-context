---
id: RULE-search-may-rank-its-results-and-the-model-it-asks-is-the
type: rule
title: search may rank its results, and the model it asks is the user’s own `claude -p` rather than one this project ships
status: active
severity: hard
always: false
summary: The owner ruled that search may order results by relevance and that semantic search ships from the start, using the user’s own Claude CLI rather than a bundled model.
summary_of: f12cf8beb70b0f9c
scope:
  - src/core/conversation-search.ts
  - src/ui/public/screens/conversations.js
  - src/core/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:3"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: c39281aa35312da5
---

# search may rank its results, and the model it asks is the user’s own `claude -p` rather than one this project ships

THE OWNER RULED 2026-09-16, in two messages, and both halves of
`OPENQ-may-search-rank-its-results-and-is-a-model-worth-a-runtime` are answered:

  "implement it completelly including the semantic search, the model is always available
   because users ar using it for development, it is not expansive and i want you to
   implement it from day 0"
  "claude -p is correct"

── HALF ONE: SEARCH MAY RANK ──────────────────────────────────────

`filterItems` REFUSED TO RANK on purpose, and that refusal is lifted. It was the real gate,
not the absence of features: AND/OR/NOT, prefix, phrase and NEAR all exist in FTS5 already
and every one of them returns a pile rather than an answer without an order over it.

What is ruled is that a result LIST MAY BE ORDERED BY RELEVANCE. What is NOT ruled, and what
no lane may decide quietly, is that ranking may DROP anything. `INV-nothing-is-dropped-silently`
stands: a result set that is truncated says so and says by how much. Ordering is not filtering.

── HALF TWO: THE MODEL IS THE ONE THE USER ALREADY HAS, REACHED BY `claude -p` ──────

NOT a bundled embeddings model, and NOT an API key this project holds. The plugin shells out
to the user’s own Claude Code CLI, already installed and already authenticated, because this
plugin only ever runs inside it.

WHY THIS DOES NOT BREACH `CONST-zero-runtime-dependencies`, stated so it is not re-argued:
`dependencies` stays empty and nothing is fetched at install. `claude` is not a dependency of
this plugin — it is the HOST the plugin runs inside, the same way `node` is. The constraint is
about what a consumer must download to install this; it costs them nothing new.

WHY IT DOES NOT BREACH HIS STANDING RULE THAT THE CONVERSATION IS HIS PROPERTY: the transcripts
were produced BY Claude Code and are already Anthropic’s to have seen. No new party is shown
anything. THIS IS AN ARGUMENT, NOT A MEASUREMENT, and a lane must confirm the two ways it could
be false: that `claude -p` runs under the same account and config as the session that wrote the
transcript, and that nothing is ever sent from a project other than the one being searched.

── WHAT IS RULED AND WHAT IS STILL TO BE MEASURED ───────────────────────

RULED: ranking is allowed; semantic search ships from day one; the model is reached by
`claude -p`. A lane may build on all three without asking again.

NOT RULED, AND EVERY ONE OF THESE IS A NUMBER NOBODY HAS TAKEN. The owner said it is not
expensive and that is his call to make — but "he ruled the cost is acceptable" is not the same
claim as "the cost is X", and this project has been wrong before by treating an instinct as a
measurement:
  — RECURSION, and it is the sharp one. `claude -p` spawned from this plugin starts a NEW
    Claude Code session, which loads THIS PLUGIN’S OWN HOOKS, which inject the corpus and run
    the anchor pass. A search that silently starts a session that indexes and marks is not a
    search. Measure it before anything else, and neutralise it.
  — LATENCY. "1–3 seconds" is an estimate this session made up. Measure the real one, cold
    and warm, and design the surface around what it turns out to be.
  — TOKENS PER QUERY, so "not expensive" has a number beside it.

── THE THREE WAYS IT CAN BE UNAVAILABLE ARE THREE ANSWERS ───────────────────

`nothing-to-do-and-could-not-look-are-different-answers` applies directly and is the easiest
thing to get wrong here. "No semantic result" must never be the value for:
  — `claude` is not on PATH — the plugin is installed somewhere it was not expected;
  — `claude` is there but NOT AUTHENTICATED;
  — it answered, and nothing matched.
The third is a measured zero. The first two are refusals and the reader must be told which,
because one is fixed by installing something and the other by logging in. A search box that
says "no matches" to a reader who is simply logged out is the exact defect that rule names.

AND THE DETERMINISTIC SEARCH MUST STAND ALONE. Whatever the model does or does not answer,
the FTS5 half — multi-word, whole-word, case, regex, ranked — works with `claude` absent.
Semantic is an ADDITION to a search that already works, never the thing that makes it work.

## Observations
- [supersession] Replaces OPENQ-may-search-rank-its-results-and-is-a-model-worth-a-runtime: The owner answered both halves on 2026-09-16: search may rank, and the model is his own `claude -p` rather than a bundled one. The question's measurements are not lost — the rule restates the ones that still bind and names the three the ruling did not settle.

## Relations
- supersedes [[OPENQ-may-search-rank-its-results-and-is-a-model-worth-a-runtime]]

## Request

implement it completelly including the semantic search, the model is always available because users ar using it for development, it is not expansive and i want you to implement it from day 0 / claude -p is correct
