---
id: TASK-adding-a-member-to-an-outcome-union-produces-zero-compiler
type: task
title: adding a member to an outcome union produces zero compiler errors, and one clause returns the empty string instead
status: active
severity: soft
always: false
summary: New results can be added to a list of possible outcomes without anything forcing the code that reads them to handle the new case.
summary_of: b2f6c429f359eded
scope:
  - src/core/**
  - src/ui/read-model.ts
tags:
  - v2
  - types
  - exhaustiveness
  - fail-open
  - "plan:rulings"
  - "seq:86"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: a2c267e7df10c41f
plan: rulings
seq: "86"
state: todo
priority: "1"
---

# adding a member to an outcome union produces zero compiler errors, and one clause returns the empty string instead

FOUND INDEPENDENTLY BY TWO REVIEWS. Report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 5) reached it from the type surface; report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M12 and M13) reached it as a silent failure. Row 19 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The outcome unions are the right SHAPE and nothing forces a caller to handle a new member. Adding a member to `ClearOutcome` or to `Upkeep` produces ZERO `tsc` errors. `actClause`'s bare `return ''` swallows a fifth `did`. `TurnAnchors`' `failed` state is report 3's M12, where the anchor pass reports the budget working and hides the defect.

THE COUNT THAT MAKES IT A HABIT AND NOT AN OVERSIGHT: one `const _: never` in the whole tree, and no `assertNever` anywhere.

THE CONSEQUENCE. A new outcome added by a new path compiles, is written, and is then read back as nothing by every existing consumer -- the unlisted input taking the benign branch, which is the subject D64 names.
