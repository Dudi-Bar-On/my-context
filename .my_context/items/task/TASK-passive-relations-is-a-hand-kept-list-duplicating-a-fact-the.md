---
id: TASK-passive-relations-is-a-hand-kept-list-duplicating-a-fact-the
type: task
title: PASSIVE_RELATIONS is a hand-kept list duplicating a fact the vocabulary already states in prose
status: active
severity: soft
always: false
summary: Derived from a new structured field in the vocabulary instead of hand-typed, and the guard this item believed existed did not, so two were written.
summary_of: bc0b3bc92168fa98
summary_was:
  - 2026-09-11 A two-member set in the search module repeats, as a second hand-typed list, exactly what the relation vocabulary's own descriptions already say in words.
acknowledged:
  - task_unverified@33807fe34d247d74
scope:
  - src/core/search.ts
  - src/core/vocabulary.ts
tags:
  - v2
  - rulings
  - relations
  - "state:done"
  - "plan:rulings"
  - "seq:55"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 0acc21c7623c08f9
plan: rulings
seq: "55"
state: done
priority: "3"
---

# PASSIVE_RELATIONS is a hand-kept list duplicating a fact the vocabulary already states in prose

Derive `PASSIVE_RELATIONS` (src/core/search.ts, ~line 104: `new Set(['discovered_by', 'enforced_by'])`) from `vocabulary.ts`'s own prose instead of hand-typing the two members a second time.

`RELATION_MEANINGS.discovered_by` and `.enforced_by` (src/core/vocabulary.ts, ~lines 162 and 171) both literally contain the phrase 'the PASSIVE reading of' — `search.ts`'s own comment already names this as the one piece of information the vocabulary's prose carries 'that no export currently states as data.' Either parse that marker out of the prose at load time, or — more robust — add an explicit structured field to the vocabulary entry (e.g. `passiveOf: 'produced'` on `discovered_by`'s entry) and derive `PASSIVE_RELATIONS` from whichever entries carry that field, rather than continuing to hand-type the Set.

Keep the existing guard test passing against the derived value — it pins the set's members to exactly two and to keys of `INVERSE_RELATIONS`, so a third inverse pair added to the vocabulary without a matching passive marker still fails loudly instead of being silently treated as an ordinary, non-reversing relation.

CLOSED 2026-09-12 by the second of the two repairs this item offered - the structured field, not the prose parse. WHAT SHIPPED. src/core/vocabulary.ts gains PASSIVE_OF, keyed by the PASSIVE name and valued with the ACTIVE one: discovered_by to produced, enforced_by to enforces. src/core/search.ts now reads PASSIVE_RELATIONS = new Set(Object.keys(PASSIVE_OF)) and hand-types nothing. Keyed passive-first because that is the direction a read path needs: given a stored row's type, is it passive, and what does it read as reversed. AND THE GUARD THIS ITEM SAID ALREADY EXISTED DOES NOT, which is worth recording. This item states that the guard test added alongside the constant asserts the set's members are exactly two and are both keys of INVERSE_RELATIONS. There was no such test. PASSIVE_RELATIONS had no test naming it anywhere in test/, and relationLinks - the only function that reads it - was named by no test file at all. So the constant this item calls protected was unprotected, and the derivation could not invalidate a guard that did not exist. TWO ASSERTIONS NOW HOLD IT, both in test/core/relation-inverses.test.ts, and each has its own removal proof. One ties the DATA to the PROSE in both directions: the entries whose RELATION_MEANINGS sentence carries the marker `the PASSIVE reading of` are exactly the keys of PASSIVE_OF, and each maps to the active name INVERSE_RELATIONS already declares. Proved by mis-declaring a key: red at its own line, and the other assertion stayed green, which is correct because it measures something else. The other drives EVERY name in RELATION_TYPES through relationLinks and asserts the set it actually reverses equals the keys of PASSIVE_OF - the behavioural half, so the DERIVED value is proved to be the one in force rather than the constant being restated. Proved by hand-typing a wrong set back into search.ts: red at its own line. Fourteen of fourteen pass.
