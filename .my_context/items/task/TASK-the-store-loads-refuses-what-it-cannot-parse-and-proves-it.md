---
id: TASK-the-store-loads-refuses-what-it-cannot-parse-and-proves-it
type: task
title: the store loads, refuses what it cannot parse, and proves it has not been tampered with
status: active
severity: soft
always: false
summary: The product ships its own set of rules, and refuses to run against a set that has been changed or is missing pieces.
summary_of: f5b2bdceb4f5456a
scope:
  - src/rules/**
  - src/cli/commands/rules.ts
  - test/rules/**
tags:
  - v2
  - store
  - "plan:store"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 338c3c03b8d8f0a7
plan: store
seq: "1"
state: todo
priority: "1"
---

# the store loads, refuses what it cannot parse, and proves it has not been tampered with

D41 PHASE 1. Plan: docs/superpowers/plans/2026-09-10-d41-product-rule-store.md Tasks 1-5. Design: docs/superpowers/specs/2026-09-10-product-rule-store-design.md sections 3, 4, 7, 13.

Five tasks: the per-kind template that IS the schema, the check and the form at once; the loader
and its tier filter; the isolation guard that the corpus never sees the store; the integrity
manifest; and `mycontext rules verify --restore`.

THIS PHASE MUST BE WHOLE BEFORE PHASE 2 STARTS. Delivering a store whose integrity is unverified
is worse than not delivering it: every later phase treats the store as true.

THE ONE TASK MOST LIKELY TO ROT is the isolation guard. It passes trivially today because nothing
knows the store exists, so its value is entirely as a tripwire against a later phase wiring the
store into `doctor`, `list`, `ready` or the injection selector by accident. Prove it can fail -
point one surface at the store, watch it go red, revert - and record that you did.
