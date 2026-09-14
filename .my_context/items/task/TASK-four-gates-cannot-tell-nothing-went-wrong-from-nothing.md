---
id: TASK-four-gates-cannot-tell-nothing-went-wrong-from-nothing
type: task
title: four gates cannot tell nothing went wrong from nothing happened
status: active
severity: soft
always: false
summary: Four checks report success when the thing they were meant to check never ran at all.
summary_of: c9aa9838daf5516d
scope:
  - scripts/**
  - test/**
  - e2e/**
tags:
  - v2
  - tests
  - gate
  - vacuous
  - "plan:gates"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 0dda25444e7717e8
plan: gates
seq: "5"
state: done
priority: "3"
---

# four gates cannot tell nothing went wrong from nothing happened

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`) as row 115 of `reports/2026-09-13-the-consolidated-findings.md`. FOUR MORE GATES THAT CAN REPORT GREEN OVER A RED RUN:

- `e2e-gate.ts` guards on `total1 === 0` rather than `failed1.length === 0` -- so a suite that ran nothing passes.
- `harness/baseline.mjs`'s `.catch` makes a suite that NEVER SPAWNED produce `failed: 0` and print "baseline matches the pin".
- `library-screen.test.ts` passes a STRING as `assert.throws`'s matcher, where Node treats it as the message -- so the assertion does not check what it appears to check.
- Two `composer-staging` e2e specs SKIP ON A PROPERTY OF THE DEVELOPER'S WORKING TREE, so whether they run at all depends on who is running them.

WHY THEY ARE ONE ITEM. All four are the same failure of a gate to distinguish "nothing went wrong" from "nothing happened" -- and this project's own doctrine is that a checker is not verified until it has been made red. Rows 11, 16, 46 and 70 are the other members of this subject.
