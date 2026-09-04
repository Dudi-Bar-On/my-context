---
id: TASK-the-configure-screen-writes-the-budget-behind-the-diff-a
type: task
title: the Configure screen writes the budget, behind the diff a boundary change gets
status: active
severity: soft
always: false
summary: Let a person change the size limits from the settings screen, behind a confirmation showing exactly which values change.
summary_of: 43c8fcd3b3436714
scope: []
tags:
  - v2
  - injection
  - budgets
  - ui
  - "plan:budget"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: d5814992e218d92d
plan: budget
seq: "5"
state: done
priority: "2"
source: owner, 2026-08-27
---

# the Configure screen writes the budget, behind the diff a boundary change gets

Implements DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to. The Simulate screen already lets a user drag budgets until a setup fits; this is the step that has been missing since -- the answer being APPLIED rather than retyped.

BUDGETS ONLY. Never `categories`, `watchedDocs`, `profile` or `ui`; the deny hook stays right about all of them. Behind the same field-by-field confirm Execute gives a boundary command -- a budget change alters what EVERY future session is shown, which is a boundary crossing by any reading. Audited like any other write.

AND `cfg.nocmd` BECOMES FALSE THE DAY THIS LANDS. It is user-facing text asserting that this cannot happen, drawn on the Configure screen and declared by the mockup, so `strings-parity`'s gap direction will hold it to being REWRITTEN rather than deleted. Rewrite it to say what stays true: no COMMAND edits a budget, and an agent still cannot -- a person can, here, behind a confirm.
