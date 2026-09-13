---
id: TASK-the-checks-file-splits-along-a-boundary-its-own-tests
type: task
title: the checks file splits along a boundary its own tests already draw, but the registry guard goes in first
status: active
severity: soft
always: false
summary: The health-check file is large enough to split along a line its tests already draw, provided a safeguard goes in first so no check is lost on the way.
summary_of: 3703a04c4eb459a4
scope:
  - src/doctor/checks.ts
  - test/doctor/**
tags:
  - v2
  - doctor
  - accretion
  - refactor
  - "plan:accretion"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7917696865257d4f
plan: accretion
seq: "2"
state: todo
priority: "2"
---

# the checks file splits along a boundary its own tests already draw, but the registry guard goes in first

Raised by report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`, section 3) as row 79 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `src/doctor/checks.ts` is 4,631 lines holding roughly thirty to forty independent checks, and it splits along a boundary ITS OWN TEST SUITE HAS ALREADY DRAWN.

THE ORDER IS PART OF THE FINDING AND MUST NOT BE DROPPED. ADD THE `runChecks` REGISTRY GUARD FIRST. A hand-kept array of checks is exactly the thing that loses an entry during a mechanical split, and THIS PROJECT HAS ALREADY PAID FOR THAT ONCE. The guard is also row 65's mechanism -- a fact kept by hand, derived instead -- so the two items share a fix.

WHY IT IS WORTH THE EFFORT AT ALL. Four of the doctor rows in this consolidation (17, 49, 67, 69) are edits inside this file, and every one of them is harder to make confidently while thirty checks share one module.
