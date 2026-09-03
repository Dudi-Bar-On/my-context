---
id: RULE-filter-seen-before-budgeting
type: rule
title: Filter already-seen items before budgeting, never after
status: active
severity: hard
always: false
summary: Drop what the reader already has before deciding what fits in the space, or the things they have seen crowd out the things they have not.
summary_of: 39b37f14170d52d9
scope:
  - src/core/select.ts
tags:
  - selector
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 33477fbee3e5acd5
directive: do
---

# Filter already-seen items before budgeting, never after

Budgeting first lets an item Claude already has consume budget and push a fresh
constraint into spill — a silent loss no test catches until the ledger exists.
The ordering looks arbitrary and invites "simplification" back to the wrong form.

## Observations
- [history] This bug was fixed once in only one of the two copies of select() in the plan, so it shipped anyway
