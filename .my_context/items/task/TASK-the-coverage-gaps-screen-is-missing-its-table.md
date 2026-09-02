---
id: TASK-the-coverage-gaps-screen-is-missing-its-table
type: task
title: the Coverage gaps screen is missing its table
status: active
severity: soft
always: false
summary: A few cell-level pieces of the coverage table are still missing, though the table itself has since been built.
summary_of: db8de9cac9f4a285
scope: []
tags:
  - "plan:screens"
  - "seq:4s"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 4fb7ef473749609f
plan: screens
seq: 4s
state: todo
---

# the Coverage gaps screen is missing its table

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  p.small, table, tbody, th, thead, tr, b, button.icon, span.m, span.v, td, td.m, td.small.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, REDUCED -- and the title is now wrong.

THE TABLE LANDED. Seven of the thirteen kinds this task lists are no longer missing: p.small, table, tbody, th, thead, tr, b. The `gaps` entry in KNOWN_GAPS is down to SIX, and by that file s own rule it could not have shrunk unless the gaps closed.

WHAT IS ACTUALLY LEFT, and it is a different task from the one the title names:
  button.icon   an affordance, not a row
  span.m span.v td td.m td.small   cell-level kinds inside the table that now exists

Read the six, not the thirteen. A body that names closed gaps is how a task gets rebuilt from scratch by somebody who trusted it.
