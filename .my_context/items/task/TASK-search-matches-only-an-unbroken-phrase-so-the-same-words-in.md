---
id: TASK-search-matches-only-an-unbroken-phrase-so-the-same-words-in
type: task
title: search matches only an unbroken phrase, so the same words in another order find nothing
status: active
severity: soft
always: false
summary: The corpus search matches a query only where it appears as one unbroken phrase, so the same words in another order find nothing.
summary_of: 407d9122523895d6
scope:
  - src/cli/commands/search.ts
  - src/core/search.ts
  - src/ui/read-model.ts
tags:
  - v2
  - cli
  - search
  - "plan:walk"
  - "seq:134"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: bf08bd506bb65814
plan: walk
seq: "134"
state: todo
priority: "2"
---

# search matches only an unbroken phrase, so the same words in another order find nothing

Measured on this corpus: "fresh ui" and "server for every test" each return the one item whose
title contains that exact run of characters, while "spawns server" returns nothing even though
both words sit in the same title a few words apart, and "ui server fresh spawns" returns nothing
although every word is present. The query is being matched as a contiguous substring; there is no
per-word AND, and word order decides the result.

The cost is concrete rather than theoretical. This is the surface a person or an agent uses to
check whether an item already exists before creating one, and a plausible paraphrase returns zero
and reads as proof of absence. A drafting pass on 2026-09-04 hit exactly that: several long
phrasings returned nothing and had to be retried as two-word fragments before near-relatives
surfaced, and four board rows were nearly duplicated as a result.

What to build: decide and implement the matching rule the flag actually promises, then say it in
the usage line and in the no-match message. Two candidates, and the choice is the work: match
every whitespace-separated word independently and rank by how many hit, which finds paraphrases
and reorderings; or keep substring matching and offer phrase-versus-words as a flag. Either way
the no-match text must stop implying the corpus is empty of the subject when it is only empty of
that character sequence, since it currently reads "Widen it: drop a filter, try a shorter phrase"
without saying that word order is what defeated the query.

The same rule reaches GET /api/search and the query tool, and they must move together: a filter
that means one thing in the terminal and another over HTTP is the disagreement this project keeps
paying for. Whatever is chosen, pin it with a test that asserts a reordered query finds the same
item as the ordered one, or the behaviour will drift back unremarked.
