---
id: TASK-the-carry-disclosure-was-silent-about-the-one-drop-the
type: task
title: the carry disclosure was silent about the one drop the feature exists to prevent
status: active
severity: soft
always: false
summary: The notice meant to list everything left out was itself leaving one case out, and it was the very case the notice exists to catch.
summary_of: 6e7127084160b6f1
acknowledged:
  - state_unaudited@74f9bf65e76291e9
scope: []
tags:
  - "plan:hooks"
  - "seq:19a"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: f37d5681bb7e58a2
plan: hooks
seq: 19a
state: done
priority: "1"
---

# the carry disclosure was silent about the one drop the feature exists to prevent

Found by hooks task 19, and it is the sharpest defect of the batch.

IndexSummary.carried.dropped carries its own comment: 'every carried id that got no line AND why'. The loop skipped every CANDIDATE - and a carried line sits at the FRONT of fitIndexOrder, not outside it. So a carried candidate that overflowed budgets.index got no line and no reason, reaching the reader only as an anonymous unit of '+N more'.

That is INV-nothing-is-dropped-silently failing inside the feature written to enforce it.

Fixed as a SIXTH reason - 'over the index budget' - rather than a fourth field, so the shape stays one list of ids with one reason each: one clause to render, one string key for the UI. shown + dropped.length === carried.ids.length is now the field's stated contract and is asserted over three fixtures.

Recorded because the shape of the mistake generalises: a disclosure that enumerates only the cases it thought of is not a disclosure, and the count identity is what makes it checkable.
