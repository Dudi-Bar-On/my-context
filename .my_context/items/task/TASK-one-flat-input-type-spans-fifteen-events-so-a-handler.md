---
id: TASK-one-flat-input-type-spans-fifteen-events-so-a-handler
type: task
title: one flat input type spans fifteen events, so a handler compiles reading a field its event never carries
status: active
severity: soft
always: false
summary: One shared shape covers fifteen different events, so code can read a value that its event never sends and get nothing, with no warning.
summary_of: 778460964c2f5309
scope:
  - src/hooks/**
tags:
  - v2
  - types
  - invariant
  - hooks
  - "plan:invariant"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 34ed1f17aeae47e8
plan: invariant
seq: "3"
state: todo
priority: "2"
---

# one flat input type spans fifteen events, so a handler compiles reading a field its event never carries

Raised by report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 4.5) as row 73 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `HookInput` is ONE FLAT INTERFACE with about 25 optional fields spanning fifteen platform events. So `input.compact_summary` COMPILES on a `SessionStart` handler and yields `undefined` at run time -- a field that cannot exist on that event, accepted by the compiler.

AND THERE IS A SECOND, DIVERGENT `HookInput` under the same name in `post-tool-use.ts`.

THE COMPARISON THAT SETTLES THE DESIGN QUESTION. The OUTPUT envelope in the same product has a proper closed union, with the argument for it written out. The shape is known, argued and applied on one side of the boundary only.

THE CONSEQUENCE. Every hook handler can read fields from events it never receives, and nothing anywhere says which fields its own event actually carries.
