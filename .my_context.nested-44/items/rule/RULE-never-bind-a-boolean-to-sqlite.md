---
id: RULE-never-bind-a-boolean-to-sqlite
type: rule
title: "Never bind a JavaScript boolean to a node:sqlite statement"
status: active
severity: hard
always: false
scope:
  - src/core/store.ts
  - src/core/ledger.ts
tags:
  - sqlite
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: f55a651cccb77c50
directive: dont
---

# Never bind a JavaScript boolean to a node:sqlite statement

`node:sqlite` throws `Provided value cannot be bound to SQLite parameter` on a
boolean. Convert to 1/0 at the call site. This typechecks cleanly and fails only
at runtime, so the type system will not catch it for you.

## Observations
- [rule] Write `item.always ? 1 : 0` — the conversion is load-bearing, not stylistic
- [fact] .get() returns undefined (never null) for a missing row, and a null-prototype object
