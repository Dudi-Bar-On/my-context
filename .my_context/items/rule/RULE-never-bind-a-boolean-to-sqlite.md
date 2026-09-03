---
id: RULE-never-bind-a-boolean-to-sqlite
type: rule
title: "Never bind a JavaScript boolean to a node:sqlite statement"
status: active
severity: hard
always: false
summary: True and false cannot be handed straight to the database; pass 1 or 0, because this mistake looks correct to every check and only fails when it runs.
summary_of: 53dc11c4c87c0e08
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
checksum: 40e9df02b431b9bb
directive: dont
---

# Never bind a JavaScript boolean to a node:sqlite statement

`node:sqlite` throws `Provided value cannot be bound to SQLite parameter` on a
boolean. Convert to 1/0 at the call site. This typechecks cleanly and fails only
at runtime, so the type system will not catch it for you.

## Observations
- [rule] Write `item.always ? 1 : 0` — the conversion is load-bearing, not stylistic
- [fact] .get() returns undefined (never null) for a missing row, and a null-prototype object
