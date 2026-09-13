---
id: TASK-the-rail-badge-and-its-own-screen-report-two-different
type: task
title: the rail badge and its own screen report two different correct numbers with nothing reconciling them
status: active
severity: soft
always: false
summary: A navigation badge and the screen it opens show different totals for the same thing, both correct, with nothing explaining what each one counts.
summary_of: 7add170e6d54cedc
scope:
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - disclosure
  - counts
  - "plan:walk"
  - "seq:151"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: fc6f885ba8e50657
plan: walk
seq: "151"
state: todo
priority: "3"
---

# the rail badge and its own screen report two different correct numbers with nothing reconciling them

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 1.5) as row 90 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The rail badge reads `Doctor 38`. The Doctor screen itself reads "findings: 95 . ... already ruled on: 49 ...". BOTH NUMBERS ARE CORRECT -- they count different things -- and NOTHING ON THE SCREEN RECONCILES THEM.

WHY IT IS D46. The subject is that a number on a screen says what it is a number of. Two true counts of the same subject, side by side, with no sentence saying what each one counts, is the same defect as a blank that does not say why it is blank: the reader cannot tell which question was answered.

THE FIX IS A SENTENCE, not a recount.
