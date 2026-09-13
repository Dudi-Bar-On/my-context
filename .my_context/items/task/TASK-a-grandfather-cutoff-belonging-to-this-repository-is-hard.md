---
id: TASK-a-grandfather-cutoff-belonging-to-this-repository-is-hard
type: task
title: a grandfather cutoff belonging to this repository is hard-coded, so every closed task in a new install is reported unverified
status: active
severity: soft
always: false
summary: A date meaningful only to this project is built into the shipped tool, so a newcomer's very first health check accuses all of their finished work.
summary_of: 39236b0cced69f88
scope:
  - src/doctor/checks.ts
tags:
  - v2
  - doctor
  - consumer-install
  - noise
  - "plan:dxfindings"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: b53ca5b825fee88d
plan: dxfindings
seq: "1"
state: done
priority: "1"
---

# a grandfather cutoff belonging to this repository is hard-coded, so every closed task in a new install is reported unverified

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, G3) as row 17 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `VERIFIED_ON_INTRODUCED_AT = '2026-09-03T12:00:00.000Z'` is THIS repository's own grandfather cutoff, hard-coded into shipped product code.

WHAT IT DOES TO A STRANGER. In an install created today every closed task predates nothing, so EVERY one of them raises `task_unverified` from day one. Here the cutoff is doing its job and the count is 53 of 107 findings; in a new install it is all of them, and doctor's first run is a wall of noise about work the user has not done yet.

WHY IT IS CRITICAL. It ships a wrong answer into somebody else's install. It is also the other half of the cause of row 49 -- the 20,180 px doctor page -- because half those findings are this.

THE SUBJECT. A doctor finding has to earn the reader's attention; one that is guaranteed to fire for a reason that has nothing to do with the reader's project spends it instead.
