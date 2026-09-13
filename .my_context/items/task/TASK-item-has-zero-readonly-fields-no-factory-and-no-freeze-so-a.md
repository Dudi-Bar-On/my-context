---
id: TASK-item-has-zero-readonly-fields-no-factory-and-no-freeze-so-a
type: task
title: Item has zero readonly fields, no factory and no freeze, so a stale checksum is a valid live value
status: active
severity: soft
always: false
summary: The central record can be changed field by field with nothing stopping it, so for a moment a record whose fingerprint no longer matches it is perfectly acceptable everywhere.
summary_of: b75ec962467c0c05
scope:
  - src/core/item.ts
  - src/core/mutate.ts
  - src/core/persist.ts
tags:
  - v2
  - types
  - invariant
  - checksum
  - "plan:invariant"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5391754b43c17771
plan: invariant
seq: "2"
state: todo
priority: "2"
---

# Item has zero readonly fields, no factory and no freeze, so a stale checksum is a valid live value

Raised by report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 4.1) as row 72 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `Item` has ZERO `readonly` modifiers, no factory and no freeze. `applyUpdate` mutates it field by field and `persist` re-stamps the checksum afterwards -- so BETWEEN THOSE TWO POINTS an `Item` carrying a stale checksum is a live, valid, fully-typed value that any function will accept.

THE COUNT THAT MAKES IT A SUBJECT: ten invariants, ten comments, zero compiler guarantees.

WHY IT IS NOT A REFACTOR FOR ITS OWN SAKE. This corpus's whole claim is that an item's recorded checksum describes its content. The guarantee is therefore a matter of timing rather than of type: nothing stops a caller holding the value inside that window.

THE TEMPLATE IS IN THE TREE. Report 4 names `UPDATE_FIELD_POLICY`, `SUMMARY_BASIS` and `resolveConfig` as three places where this project already made the compiler carry the invariant, and calls the first of them the best type in the product.
