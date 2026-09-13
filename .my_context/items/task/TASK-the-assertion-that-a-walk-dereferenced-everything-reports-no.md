---
id: TASK-the-assertion-that-a-walk-dereferenced-everything-reports-no
type: task
title: the assertion that a walk dereferenced everything reports no symlinks for a directory it could not read
status: active
severity: soft
always: false
summary: A safety check reports all clear for a folder it was unable to read, and the confirmation shown before a destructive action quietly gets weaker.
summary_of: ad70b94c1e0ab219
scope:
  - src/core/**
  - src/ui/**
tags:
  - v2
  - core
  - silent-failure
  - confirm
  - "plan:swallow"
  - "seq:10"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 1751e50dd39048e4
plan: swallow
seq: "10"
state: todo
priority: "3"
---

# the assertion that a walk dereferenced everything reports no symlinks for a directory it could not read

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m18) as row 108 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `symlinksUnder` -- the assertion that `dereference: true` held -- reports "no symlinks" for a directory IT COULD NOT READ. And the two snapshot walks silently narrow the confirm dialog when they fail.

THE RULE IT BREACHES, WHICH THIS PROJECT WROTE DOWN ITSELF, at `execute.ts` · the rule about a command whose effect cannot be shown (line 751): "a command whose effect cannot be shown does not get a weaker confirm -- it does not run". Here the effect cannot be shown, the confirm is quietly weakened, and the command runs.

THE CONSEQUENCE. A user approves a destructive operation on the strength of a preview that is incomplete for a reason nobody told them.
