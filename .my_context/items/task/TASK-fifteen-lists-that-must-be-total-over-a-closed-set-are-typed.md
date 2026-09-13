---
id: TASK-fifteen-lists-that-must-be-total-over-a-closed-set-are-typed
type: task
title: fifteen lists that must be total over a closed set are typed the direction that cannot check it
status: active
severity: soft
always: false
summary: Several lists that must contain every possible value are written in a way that checks nothing about what is missing, and one omission silently loses data on the next read.
summary_of: c29d44003b8a41ee
scope:
  - src/core/**
  - src/ui/**
tags:
  - v2
  - types
  - exhaustiveness
  - derived
  - "plan:rulings"
  - "seq:77"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 3a65edbeaa4f5f60
plan: rulings
seq: "77"
state: todo
priority: "2"
---

# fifteen lists that must be total over a closed set are typed the direction that cannot check it

Raised by report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 2) as row 64 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. About fifteen value lists that must be TOTAL over a closed union are typed `T[]`, which checks the wrong direction: it proves every entry is a member, and proves nothing about members that were left out.

THE SHARPEST INSTANCE, and it is a data-loss shape, not a tidiness one. `OUTCOMES`: a thirteenth `UpkeepOutcome` written by a new path but forgotten in the list COMPILES, WRITES CORRECTLY, and DEGRADES TO `null` ON THE VERY NEXT READ-BACK.

WHAT IT COSTS TO FIX, measured rather than estimated: `Covers<>` plus `as const satisfies`, two lines per site, about 18 sites -- ZERO call sites touched and ZERO behaviour change.

THE SUBJECT. D51 is a fact kept by hand in a second place. The union is the fact; the list is the hand-kept copy; the compiler is willing to derive the relationship and is not being asked to.
