---
id: TASK-the-corpus-box-refuses-to-rank-so-it-returns-the-right-item
type: task
title: the corpus box refuses to rank, so it returns the right item none of the time out of forty-two
status: active
severity: soft
always: false
summary: Searching the knowledge base returns everything that matched in no useful order, so the thing you wanted is buried.
summary_of: 4237b0b9f36383cb
scope:
  - src/core/search.ts
  - src/core/store.ts
  - src/ui/read-model*.ts
  - src/ui/public/screens/**
  - test/**
tags:
  - v2
  - recall
  - "plan:semantic"
  - "seq:7"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: baac1f3ce3f6879e
plan: semantic
seq: "7"
state: todo
priority: "1"
---

# the corpus box refuses to rank, so it returns the right item none of the time out of forty-two

THE OWNER RULED IT IN, 2026-09-16, reading the measurement: "2 yes".

THE MEASUREMENT, taken by `semantic/1` against his own 42 requests and not to be re-derived:
THE SHIPPED CORPUS SEARCH RETURNS THE RIGHT ITEM 0 TIMES OUT OF 42. With ranking it reaches
15 of 42 in 535 ms. That is the whole case.

`filterItems` REFUSES TO RANK, on purpose and in its own docblock. That refusal is now LIFTED
by `RULE-search-may-rank-its-results-and-semantic-search-is-not`. Read the rule before you
start; it also says what ranking may NOT do.

ORDERING IS NOT FILTERING. `INV-nothing-is-dropped-silently` stands: a ranked set that is
truncated says so and says by how much. And DO NOT REBUILD THE BOUND-BEFORE-SCOPE DEFECT —
ranking applied before a scope is how the per-turn anchor pass silently stopped for half an
hour, and `nothing-to-do-and-could-not-look-are-different-answers` (rule store) is written
about exactly that. A bound is not a scope: if the caller filters the results, the filter
belongs IN the request.

── THIS IS THE CORPUS BOX, NOT THE CONVERSATION BOX ───────────────────

They are different surfaces over different stores and lane AF has just shipped the other one
(`semantic/4`, three readings in tiers, on the ARCHIVE). §4 of
`reports/2026-09-16-the-search-grammar.md` says plainly that NONE of those three transfers to
`filterItems` as-is, and that AND-ing five terms here is ruinous — 2 of 42. READ §4 FIRST. What
this box needs is the RANKING, and that is a different build.

So do not copy the tiers here without measuring them here. If a tier shape turns out to help
this box too, that is a finding and needs its own numbers.

── WHAT A RANK MEANS HERE, WHICH IS THE PART TO THINK ABOUT ───────────────

A corpus item is not a passage. It has a title, a summary, a body, tags, a category, a status,
a severity and relations, and a match in a TITLE is not worth what a match in a body is worth.
Say what you rank on and why, and hold it with a test that fails if the weighting is reversed.

The 42 requests are the acceptance set and they are real. Report the before and after against
them, and name the ones it STILL misses — 15 of 42 is the number to beat, not to reach and
stop. A miss you can explain is worth more than a score you cannot.

AND THE FLOOR MUST NOT MOVE: an item that matches today must still be findable. Ranking
reorders; it does not remove. Prove that with a removal proof, not with a sentence.
