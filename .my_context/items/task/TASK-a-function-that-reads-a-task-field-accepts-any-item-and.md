---
id: TASK-a-function-that-reads-a-task-field-accepts-any-item-and
type: task
title: a function that reads a task field accepts any item and answers empty for a category that has no such field
status: active
severity: soft
always: false
summary: A lookup meant for one kind of entry accepts every kind and returns a blank, which is impossible to tell apart from a real entry that was left blank.
summary_of: 24880c2d127b1332
scope:
  - src/core/item.ts
  - src/core/**
tags:
  - v2
  - types
  - invariant
  - measured-zero
  - "plan:invariant"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: abb17e0ec1a7183d
plan: invariant
seq: "1"
state: todo
priority: "2"
---

# a function that reads a task field accepts any item and answers empty for a category that has no such field

Raised by report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 3) as row 71 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Category-specific fields live in `Item.extra: Record<string,string>`. So `taskState(item: Item)` accepts ANY item and answers `''` for a `requirement` -- indistinguishable from a task that declares `state` and has not set it. It is the measured-zero-versus-unmeasured defect, expressed in a function signature.

AND THE PROOF IS ALREADY COMPUTED AND THROWN AWAY: `isWorkCategory` works out exactly the fact the signature needs, and the signature does not use it.

THE LIVE INSTANCE, which is what makes this concrete rather than theoretical: D57 closed ON THE MAP rather than on its item, because "a requirement has no field to close on". That is recorded in `REF-the-d-numbers-what-each-one-means-and-which-are-only` as an owner ruling, and it is the same fact seen from the corpus side.

THE SUBJECT. Ten invariants of `Item` are held in comments and conventions. This one could be held in the type, and the project's own `UPDATE_FIELD_POLICY` -- which report 4 calls the best type in the product -- is the worked example of how.
