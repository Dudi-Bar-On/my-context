---
id: TASK-passive-relations-is-a-hand-kept-list-duplicating-a-fact-the
type: task
title: PASSIVE_RELATIONS is a hand-kept list duplicating a fact the vocabulary already states in prose
status: active
severity: soft
always: false
summary: A two-member set in the search module repeats, as a second hand-typed list, exactly what the relation vocabulary's own descriptions already say in words.
summary_of: c7ea2609f9e4d68b
scope:
  - src/core/search.ts
  - src/core/vocabulary.ts
tags:
  - v2
  - rulings
  - relations
  - "plan:rulings"
  - "seq:55"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: a8e1a1407934411b
plan: rulings
seq: "55"
state: todo
priority: "3"
---

# PASSIVE_RELATIONS is a hand-kept list duplicating a fact the vocabulary already states in prose

Derive `PASSIVE_RELATIONS` (src/core/search.ts, ~line 104: `new Set(['discovered_by', 'enforced_by'])`) from `vocabulary.ts`'s own prose instead of hand-typing the two members a second time.

`RELATION_MEANINGS.discovered_by` and `.enforced_by` (src/core/vocabulary.ts, ~lines 162 and 171) both literally contain the phrase 'the PASSIVE reading of' — `search.ts`'s own comment already names this as the one piece of information the vocabulary's prose carries 'that no export currently states as data.' Either parse that marker out of the prose at load time, or — more robust — add an explicit structured field to the vocabulary entry (e.g. `passiveOf: 'produced'` on `discovered_by`'s entry) and derive `PASSIVE_RELATIONS` from whichever entries carry that field, rather than continuing to hand-type the Set.

Keep the existing guard test passing against the derived value — it pins the set's members to exactly two and to keys of `INVERSE_RELATIONS`, so a third inverse pair added to the vocabulary without a matching passive marker still fails loudly instead of being silently treated as an ordinary, non-reversing relation.
