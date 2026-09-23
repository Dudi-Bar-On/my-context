---
id: TASK-the-decay-and-ledger-screens-say-when-the-ledger-projection
type: task
title: the Decay and Ledger screens say when the ledger projection was last rebuilt
status: active
severity: soft
always: false
summary: Two screens that show numbers derived from a history that is refreshed in batches now also show when that refresh last ran, so a reader knows how current the numbers are.
summary_of: 54009036d9dfa904
scope: []
tags:
  - "plan:walk"
  - "seq:170"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: ca01ecf1315a1c48
plan: walk
seq: "170"
state: todo
---

# the Decay and Ledger screens say when the ledger projection was last rebuilt

Filed 2026-09-22 from owner ruling G on walk/66 (see DEC-the-ledger-projection-is-rebuilt-in-batch-and-the-two): the projection is batch; each of the two screens that read it prints the time of the last rebuild beside the numbers, in the time convention of that screen (walk/142: every printed time names its clock). Closing condition: Decay and Ledger each render the last-rebuild time from the record the projection itself keeps, a browser test asserts it on both screens, both string tables carry the key. Files: the decay and ledger screen modules under src/ui/public/screens/, src/ui/public/strings/en.js and he.js, the read model that serves the projection. Phase 6, lane group 3.

## Relations
- derived_from [[DEC-the-ledger-projection-is-rebuilt-in-batch-and-the-two]]
