---
id: TASK-seven-gates-cannot-be-shown-to-go-red-and-one-of-them-has-no
type: task
title: seven gates cannot be shown to go red, and one of them has no test anywhere
status: active
severity: soft
always: false
summary: Several automated checks have never been proved capable of failing, and one has no test at all, so their passing says nothing.
summary_of: 534bbe9340eb468c
scope:
  - test/**
  - scripts/**
tags:
  - v2
  - tests
  - gate
  - positive-control
  - "plan:gates"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 6def2ce97d3889f0
plan: gates
seq: "3"
state: done
priority: "2"
---

# seven gates cannot be shown to go red, and one of them has no test anywhere

FOUND BY TWO REVIEWS, from two directions. Row 46 of `reports/2026-09-13-the-consolidated-findings.md`.

REPORT 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M25) found five gates with no positive control -- and the detail that makes each one a defect rather than a style: EACH IS THE ONLY ONE OF ITS SIBLINGS WITHOUT ONE. `graph-screen`, `corpus-checksums`, `no-bare-rmsync`, `rules/isolation`, `open-readonly-checked`.

REPORT 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, G4 and G6) found two more:
- `sessions-pin.test.ts` scans raw source with no `maskNonCode`, matches imports on single quotes only, and pins a literal substring.
- `check:needs-cycles` has NO TEST ANYWHERE and runs in neither workflow -- the only gate in the project with no evidence behind it at all.

THE PROJECT'S OWN DOCTRINE, which both reports quote: "a checker is not verified until it has been made red". Both reports also single out the house anti-vacuity pattern as one of the best things in the suite -- which is what makes these the exceptions worth naming.
