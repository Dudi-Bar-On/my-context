---
id: TASK-execution-is-its-own-audit-kind-a-run-is-not-a-mutation-of
type: task
title: execution is its own audit kind — a run is not a mutation of one item
status: active
severity: soft
always: false
summary: Running a command is recorded as its own kind of event, because a run is not a change to one item and may not concern any item at all.
summary_of: c93c29316118d23e
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - "plan:execute"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: dbf83c31a07acf76
plan: execute
seq: "4"
state: done
priority: "1"
source: owner, 2026-08-26 ruling; plan written 2026-08-27
---

# execution is its own audit kind — a run is not a mutation of one item

This item tracks state only. The task itself is Task 4 of docs/superpowers/plans/2026-08-27-execute-a-composed-command.md, which carries the tests, the code and the commit message. The design is docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md — read section 3 AND section 6 together; 6.1 widened 3.2.

The audit log is item-shaped: `mutation` carries `itemId` and `fields`. A run is not about one item and may be about none. Folding it into `mutation` would make every existing reader of that kind wrong about what it is reading — the gap DEC-should-the-web-ui-be-allowed-to-write-config-json named when it declined the write.

An unfinished run records `exitCode: null`, never 0. "We stopped watching" and "it succeeded" are different facts, and STD-absent-vs-zero governs the field where the wrong reading is the dangerous one.
