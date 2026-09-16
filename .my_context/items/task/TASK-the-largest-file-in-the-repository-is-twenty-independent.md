---
id: TASK-the-largest-file-in-the-repository-is-twenty-independent
type: task
title: the largest file in the repository is twenty independent handlers in a directory that has split eight siblings out
status: active
severity: soft
always: false
summary: The largest file in the project has been split into four, so somebody reading it can find the part they need without reading all of it.
summary_of: ef0ff2c925605e43
summary_was:
  - 2026-09-16 The biggest file in the project holds about twenty unrelated request handlers, in a folder where eight similar groups have already been separated out.
scope:
  - src/ui/read-model.ts
tags:
  - v2
  - core
  - accretion
  - refactor
  - "plan:accretion"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 21765728114f6bd5
plan: accretion
seq: "1"
state: done
priority: "2"
verified_on: 2026-09-16
---

# the largest file in the repository is twenty independent handlers in a directory that has split eight siblings out

Raised by report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`, section 2) as row 78 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `src/ui/read-model.ts` is 4,203 lines, the largest file in the repository. It is about twenty independent `apiX` handlers with almost no shared state -- in a directory that has ALREADY SPLIT EIGHT SIBLINGS OUT by domain. And the test suite is already partitioned the way the source is not.

WHY THIS ONE SURVIVED REPORT 5'S OWN SCEPTICISM, which matters. That review's headline finding was that the recorded argument usually holds: of the hypotheses it formed from file size or name alone, a MINORITY survived reading the code, and it recorded fifteen files that stay exactly as they are. This is one of the few that did not have an argument for staying whole.

AND THE PRECONDITION FROM ITS SIBLING ROW: row 79 says the `runChecks` registry guard must go in before a mechanical split, because a hand-kept array is exactly what loses an entry during one, and this project has already paid for that once.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `aebc76f0`. `read-model.ts` went 4,264 lines to 3,221 across four modules, and THE SPLIT NEEDED ZERO TEST EDITS, which is itself the evidence the boundary was already drawn. Three of the four ranges are opened by the author's own banner comments.

A FIFTH CUT WAS MEASURED AND DECLINED: the session block needs three names from the rest and the rest needs one back, so the dependency is two-way, the code does not draw that line and the lane did not invent one. Closed by the reconciliation in `rulings/93`.
