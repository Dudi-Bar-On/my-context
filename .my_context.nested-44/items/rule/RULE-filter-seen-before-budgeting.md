---
id: RULE-filter-seen-before-budgeting
type: rule
title: Filter already-seen items before budgeting, never after
status: active
severity: hard
always: false
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
checksum: c28ffbe4543657bc
directive: do
---

# Filter already-seen items before budgeting, never after

Budgeting first lets an item Claude already has consume budget and push a fresh
constraint into spill — a silent loss no test catches until the ledger exists.
The ordering looks arbitrary and invites "simplification" back to the wrong form.

## Observations
- [history] This bug was fixed once in only one of the two copies of select() in the plan, so it shipped anyway
