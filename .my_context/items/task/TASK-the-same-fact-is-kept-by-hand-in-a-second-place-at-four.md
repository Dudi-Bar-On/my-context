---
id: TASK-the-same-fact-is-kept-by-hand-in-a-second-place-at-four
type: task
title: the same fact is kept by hand in a second place at four families of site, found by three reviews
status: active
severity: soft
always: false
summary: In several places one fact is written out twice by hand so the copies can drift apart, and the project already built the mechanism that stops that.
summary_of: c45a80bfe7a0fb9c
scope:
  - src/cli/**
  - src/doctor/checks.ts
  - src/ui/**
tags:
  - v2
  - types
  - derived
  - hand-kept
  - "plan:rulings"
  - "seq:78"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 6ce3a73c5b176f44
plan: rulings
seq: "78"
state: todo
priority: "2"
---

# the same fact is kept by hand in a second place at four families of site, found by three reviews

FOUND BY THREE REVIEWS AS ONE CLASS. Row 65 of `reports/2026-09-13-the-consolidated-findings.md`.

- REPORT 4 (`reports/2026-09-13-type-design-reviewed.md`): the exhaustive value lists of row 64.
- REPORT 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`): `FIELD_NAME` in `statusline-powerline.ts`, whose OWN DOCBLOCK names the hazard and does not close it; and the `runChecks` registry, which this project has already paid for once.
- REPORT 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`): `CommandDef.usage` (row 58).

AND THE MECHANISM ALREADY EXISTS IN THE TREE, THREE TIMES: `port-model.ts`, `read-model-config.ts`, and a test that says outright "a hand-kept list of field names inside a parity test IS the defect the test exists about".

WHY THIS IS ONE ITEM RATHER THAN FOUR. Three reviewers with three different briefs converged on the same sentence. The work is to apply a mechanism this project already built and already argued for, at the remaining sites -- and D51 is exactly that subject.
