---
id: TASK-the-in-sync-verdict-draws-no-chip-and-its-own-docblock-calls
type: task
title: the in-sync verdict draws no chip, and its own docblock calls that the dangerous one
status: superseded
severity: soft
always: false
summary: The one result that can be confidently wrong is shown by drawing nothing, which the code beside it already explains is the risky choice.
summary_of: 9a3c9ee82f036743
scope:
  - src/ui/**
  - src/core/**
tags:
  - v2
  - ui
  - fail-open
  - disclosure
  - "plan:rulings"
  - "seq:89"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: 2026-09-23
checksum: 4b52e4cef2aadcef
plan: rulings
seq: "89"
state: done
priority: "3"
---

# the in-sync verdict draws no chip, and its own docblock calls that the dangerous one

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m16) as row 107 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `git-info`'s `in-sync` verdict draws NO CHIP AT ALL -- and the module's own docblock calls that verdict "the dangerous one: a wrong answer shaped exactly like a right one" for the case where the ref being compared is not the upstream.

WHY IT IS D64. Silence is the benign branch here, and it is precisely the branch that can be confidently wrong. The code already contains the argument for why this particular answer needs to be visible, and then makes it the one answer that is invisible.

THE FIX is to draw the verdict the module already computed, so a wrong `in-sync` looks like an assertion a reader can doubt rather than like nothing.

Closed 2026-09-22 by owner ruling G: in-sync stays silent; see DEC-the-in-sync-verdict-draws-no-chip-report-3-does-not-overturn.

## Relations
- superseded_by [[DEC-the-in-sync-verdict-draws-no-chip-report-3-does-not-overturn]]
