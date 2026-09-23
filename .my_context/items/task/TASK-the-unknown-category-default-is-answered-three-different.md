---
id: TASK-the-unknown-category-default-is-answered-three-different
type: task
title: the unknown-category default is answered three different ways in three files, one of them fails open
status: active
severity: soft
always: false
summary: Three places disagree about what to do with a category nobody listed, and one of them chooses the permissive answer the other two argue against.
summary_of: a162654b29693e21
scope:
  - src/core/trust.ts
  - src/cli/index.ts
  - src/core/**
tags:
  - v2
  - types
  - fail-open
  - inconsistency
  - "plan:rulings"
  - "seq:88"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: dd040bb3588dcd08
plan: rulings
seq: "88"
state: done
priority: "2"
---

# the unknown-category default is answered three different ways in three files, one of them fails open

Raised by report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 4.2) as row 75 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The unknown-category default is answered THREE DIFFERENT WAYS in three files:
- `tierOf` FAILS CLOSED, and argues in a comment why it must.
- `isNormative` answers false.
- `cli/index.ts` · the unknown-category default (line 638) FAILS OPEN to `rationale` -- which is the exact default `trust.ts` argues against, one file over.

WHY IT IS D64 AND NOT MERELY INCONSISTENCY. Two of the three let an unlisted input take a benign branch, and the third has the argument for why they must not, already written, in this repository, by this project. The disagreement is not about what the answer should be; nobody noticed there were three answers.

Report 3 and report 6 found further members of the same class; they are row 15.
