---
id: RULE-search-may-rank-its-results-and-semantic-search-is-not
type: rule
title: search may rank its results, and semantic search is not bought by spawning the model — measured and withdrawn
status: active
severity: hard
always: false
summary: Search is allowed to order results by relevance; reaching a model through the user’s Claude CLI was measured, found costly and intrusive, and ruled out.
summary_of: 341dfc708db5c611
scope:
  - src/core/conversation-search.ts
  - src/ui/public/screens/conversations.js
  - src/core/**
tags:
  - v2
  - recall
  - search
  - measured
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 626d4a7b3a29a353
---

# search may rank its results, and semantic search is not bought by spawning the model — measured and withdrawn

THE OWNER RULED TWICE ON 2026-09-16, AND THE SECOND RULING REVERSES HALF OF THE FIRST. Both are
recorded here because the reversal is the useful part: he did not change his mind, he was shown
a measurement.

── THE HALF THAT STANDS: SEARCH MAY RANK ─────────────────────────────

`filterItems` REFUSED TO RANK on purpose, and that refusal is lifted. It was the real gate, not
the absence of features: AND/OR/NOT, prefix, phrase and NEAR all exist in FTS5 already and every
one of them returns a pile rather than an answer without an order over it.

A result list MAY BE ORDERED BY RELEVANCE. IT MAY NOT DROP ANYTHING.
`INV-nothing-is-dropped-silently` stands: a set that is truncated says so and says by how much.
Ordering is not filtering, and a bound is not a scope — ranking applied BEFORE a scope is how the
per-turn anchor pass silently stopped for half an hour.

── THE HALF THAT IS WITHDRAWN: `claude -p` IS NOT THE ROUTE ────────────────

He ruled it in on the strength of an argument this session made. Lane AG measured it and he ruled
it out the same day: "ok so discard semantic search by using claude -p, agree it is bad idea".

WHAT THE MEASUREMENT FOUND, so nobody proposes it again without new numbers (`semantic/5`,
`reports/2026-09-16-claude-p-measured.md`):
  — A NAIVE CALL TURNS EACH SEARCH INTO A CONVERSATION IN THE CORPUS BEING SEARCHED. Three calls
    added three transcripts at ~496 KB EACH for a twelve-word question, three `conversations`
    rows, eight `conversation_prose` rows, six state files, and moved `.anchors.jsonl`’s mtime
    every time because the child ran its own Stop hook. Search a phrase today, find your own
    question tomorrow.
  — 8,215 ms MEDIAN (n=16, neutralised), against 4.3 ms for the deterministic search. That is a
    button, not a tier — and the estimate this session had offered was 1–3 s, wrong by 3–8x.
  — THE COST IS NOT DOLLARS, IT IS HIS WEEKLY ALLOWANCE. $0.0037 a query is nothing; his 7-day
    limit moved 0.95 → 0.96 during one lane’s run, and he is already at the top of it. "It is not
    expensive" was true about the wrong currency.
  — AND THE PRIVACY ARGUMENT WAS HALF FALSE. The retired rule argued no new party sees anything
    because the transcripts were produced by Claude Code. Measured: a naive child also carried
    his GLOBAL `~/.claude/CLAUDE.md`, his auto-memory `MEMORY.md` and his email address — machine
    configuration, not conversation content. `--safe-mode` removes all four. He was told, and
    ruled with the fact in hand.

└─ THE LESSON UNDER IT, which outlives this feature: THE RULE WAS CAPTURED FROM AN ARGUMENT AND
   NOT FROM A MEASUREMENT, and it said so in its own text — "THIS IS AN ARGUMENT, NOT A
   MEASUREMENT" — and named the two ways it could be false. One of them was. Writing down which
   part of a ruling is unmeasured is what made the correction cheap instead of a discovery.

── WHAT IS OPEN, AND IT IS HIS ───────────────────────────────────

He asked instead for "the best flexible way to implement smart and complex searches on a text
file exactly as good editors do", by adopting an open-source Node package rather than authoring
one, "without much effort", with a UI component counting as an advantage. That is `semantic/6`.

IT COLLIDES WITH `CONST-zero-runtime-dependencies`, WHICH IS HARD, AND ONLY HE MAY RELAX IT. No
lane may take a dependency on the strength of this rule. `semantic/6` costs the candidates so he
can rule with numbers; until he does, the constraint stands exactly as written.

SEMANTIC SEARCH ITSELF IS NOT REFUSED — only this route to it. Anthropic ships no embeddings
endpoint, so any future proposal is a local model (a large dependency) or a third party (his
content leaves), and both are his to rule on, with numbers, not a lane’s.

## Observations
- [supersession] Replaces RULE-search-may-rank-its-results-and-the-model-it-asks-is-the: The ranking half is carried forward unchanged. The `claude -p` half was measured by `semantic/5` and withdrawn by the owner the same day: a naive call writes the search back into the corpus as a conversation, the median is 8.2 s against 4.3 ms, the real cost is his weekly allowance rather than dollars, and the privacy argument the rule itself flagged as unmeasured turned out to be half false.
- [supersession] Replaces TASK-semantic-search-asked-of-the-model-the-user-already-has-and: Phase 1 ran and its measurements are what ended the approach; the owner discarded it rather than have it built. The question it served is now `semantic/6`: adopt an editor-grade search rather than author one.

## Relations
- supersedes [[RULE-search-may-rank-its-results-and-the-model-it-asks-is-the]]
- supersedes [[TASK-semantic-search-asked-of-the-model-the-user-already-has-and]]

## Request

ok so discard semantic search by using claude -p, agree it is bad idea, but you must find the best flexible way to implement smart and complex searches on a text file exactly as good editors do
