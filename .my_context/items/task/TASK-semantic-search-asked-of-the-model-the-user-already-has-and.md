---
id: TASK-semantic-search-asked-of-the-model-the-user-already-has-and
type: task
title: semantic search, asked of the model the user already has — and the three numbers nobody has taken before it is built
status: active
severity: soft
always: false
summary: Let the search find a passage that means what you asked even when it uses different words, by asking the Claude the user is already running.
summary_of: e84eb809e3ea14e1
scope:
  - src/core/conversation-search.ts
  - src/core/**
  - src/ui/public/screens/conversations.js
  - test/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 8320f9a4b9aec6b5
plan: semantic
seq: "5"
state: todo
priority: "1"
---

# semantic search, asked of the model the user already has — and the three numbers nobody has taken before it is built

THE OWNER RULED IT, 2026-09-16: "implement it completelly including the semantic search, the
model is always available because users ar using it for development, it is not expansive and i
want you to implement it from day 0", then "claude -p is correct".

`RULE-search-may-rank-its-results-and-the-model-it-asks-is-the` IS THE RULING AND IT IS
SETTLED. Ranking is allowed. Semantic ships. The model is the user’s own `claude -p` — NOT a
bundled embeddings model, NOT an API key this project holds. Do not reopen any of the three.
D77’s numbers stand behind it and are not to be re-derived: 11,692 vectors, brute-force cosine
at 4.3 ms per query — the INDEX was never the problem; the MODEL was.

── PHASE 1: MEASURE THREE THINGS, AND REPORT THEM BEFORE BUILDING ANYTHING ───────

The owner ruled the cost is acceptable. That is his call and it is made. But "he ruled the cost
is acceptable" is NOT the claim "the cost is X", and this campaign has already shipped three
reports whose own numbers were wrong. Take the numbers.

  1. RECURSION, AND IT IS THE SHARP ONE. `claude -p` spawned from this plugin starts a NEW
     Claude Code session — which loads THIS PLUGIN’S OWN HOOKS, which inject the corpus and
     run the anchor pass over the transcript. A search that silently starts a session that
     indexes and marks is not a search, and at worst it is a loop. MEASURE WHAT ACTUALLY
     HAPPENS — does the child load the plugin, does it write to `.anchors.jsonl`, does it
     append to the archive — and neutralise it. This is the first thing to find out and the
     answer may change the whole shape.
  2. LATENCY, cold and warm. "1–3 seconds" is a guess this session made up and nothing rests
     on it. The real number decides the surface: 400 ms is a tier, 4 s is a button.
  3. TOKENS PER QUERY, so "not expensive" has a figure beside it the owner can check.

── PHASE 2: THE THREE WAYS IT IS UNAVAILABLE ARE THREE ANSWERS ──────────────

`nothing-to-do-and-could-not-look-are-different-answers`, and this is the easiest thing here to
get wrong. "No semantic result" must never be the value for all of:
  — `claude` IS NOT ON PATH — the plugin is installed where it was not expected;
  — `claude` is there but NOT AUTHENTICATED;
  — it answered, and nothing matched.
The third is a measured zero. The first two are refusals, and the reader must be told WHICH,
because one is fixed by installing something and the other by logging in. A search box that
says "no matches" to a reader who is merely logged out is precisely that rule’s defect. Add the
READER of each disclosure in the same change — a field nobody prints is a comment with a type.

── PHASE 3: WHAT IT ACTUALLY DOES ───────────────────────────────

Anthropic ships NO embeddings endpoint, so this is not vector search and must not pretend to
be. Two shapes are open and the measurement decides between them — say which you chose and
why, against Phase 1’s numbers:
  — QUERY EXPANSION. Ask the model for the other words this idea is written in, then run the
    deterministic search from `semantic/4` over the expanded set. One call per query, the
    result is still FTS5, and every hit is a real span with a real offset.
  — RERANKING. Run the deterministic search wide, hand the model the candidates, let it order
    them. Better answers, more tokens, and it can only reorder what FTS5 already found.
Expansion is the cheaper one and is probably right; reranking is the one that answers "find the
passage where I decided X" when none of X’s words appear. They compose.

── WHAT MUST STAY TRUE ──────────────────────────────────────

  — THE DETERMINISTIC SEARCH STANDS ALONE. With `claude` absent, `semantic/4` works exactly as
    it does with it present. Semantic is an addition, never the thing that makes search work.
  — `CONST-zero-runtime-dependencies` IS UNTOUCHED and stays untouched: `dependencies` empty,
    nothing fetched at install. `claude` is the HOST, not a dependency — the rule says so.
  — THE CONVERSATION IS HIS PROPERTY. The rule argues no new party sees anything because the
    transcripts were produced BY Claude Code. THAT IS AN ARGUMENT, NOT A MEASUREMENT.
    CONFIRM BOTH WAYS IT COULD BE FALSE: that `claude -p` runs under the same account and
    config as the session that wrote the transcript, and that nothing from a project other
    than the one being searched is ever sent. If either is false, STOP AND REPORT — do not
    build around it.
  — NO SILENT SPEND. A call that costs the owner tokens is not made by a keystroke he did not
    aim. Say what triggers it.
