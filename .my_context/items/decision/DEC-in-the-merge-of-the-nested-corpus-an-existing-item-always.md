---
id: DEC-in-the-merge-of-the-nested-corpus-an-existing-item-always
type: decision
title: In the merge of the nested corpus, an existing item always wins a contradiction
status: active
severity: soft
always: false
summary: When a migrated item disagrees with one already here, the existing item wins because it is newer, and the older one is superseded rather than dropped.
summary_of: b7aa93020a003a6a
scope: []
tags:
  - merge
  - corpus
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 022ca2f87d65cf46
---

# In the merge of the nested corpus, an existing item always wins a contradiction

Owner ruling, 2026-09-04, in his own words: "migrate the 42 once --always lands, if they contradicts to existing corpus items, existing are always newer so they take".

THE RULE

Where a migrated item and an item already in this corpus say opposite things, the EXISTING item governs. It is not a judgement per case and it is not a comparison of arguments: the nested corpus was written earlier, this one has been worked in continuously since, and later overrides earlier is already this project ordering rule.

WHY A BLANKET RULE RATHER THAN A CASE-BY-CASE READING

Three contradictions were found and settled individually before the relocation - the focus-hiding requirement, the claude-mem non-goal, and the zero-dependencies constraint - and each cost a reading and a ruling. Forty-two items would produce more of them, and a merge that stops for every disagreement is a merge that does not finish. The owner has ruled the general case so the migration can run to completion without returning for each one.

WHAT THIS DOES NOT MEAN

The loser is not deleted. `RULE-a-task-is-not-done-until-its-state-says-done` and this project supersession practice both hold: a contradicted item is migrated and then SUPERSEDED by the existing one, both directions recorded, so the next reader can see what was believed earlier and what replaced it. Nothing is dropped silently - `INV-nothing-is-dropped-silently` governs the corpus as much as it governs a report.

Nor does it mean the incoming item is worthless where it does not contradict. Most of the 42 say things this corpus never recorded at all - the ADRs, the invariants, several requirements - and those arrive as they are.

WHAT TO DO WHEN IT FIRES

Migrate the item faithfully, then supersede it by the existing one and say so in the migration report. A contradiction discovered mid-merge is not a reason to stop and ask; it is a reason to record the supersession and continue. If an incoming item contradicts an existing one on a point where the EXISTING item is plainly stale rather than merely older, that is worth naming in the report - but it is reported after the fact, not resolved during.
