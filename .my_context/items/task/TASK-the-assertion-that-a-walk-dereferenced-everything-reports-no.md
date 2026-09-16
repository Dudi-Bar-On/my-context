---
id: TASK-the-assertion-that-a-walk-dereferenced-everything-reports-no
type: task
title: the assertion that a walk dereferenced everything reports no symlinks for a directory it could not read
status: active
severity: soft
always: false
summary: A preview of what a command is about to change no longer quietly leaves things out when a folder could not be read; it refuses and says so.
summary_of: 4993172a6edfc17d
summary_was:
  - 2026-09-16 A safety check reports all clear for a folder it was unable to read, and the confirmation shown before a destructive action quietly gets weaker.
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: c44e63fab590aa62
plan: swallow
seq: "10"
state: done
priority: "3"
verified_on: 2026-09-16
---

# the assertion that a walk dereferenced everything reports no symlinks for a directory it could not read

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m18) as row 108 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `symlinksUnder` -- the assertion that `dereference: true` held -- reports "no symlinks" for a directory IT COULD NOT READ. And the two snapshot walks silently narrow the confirm dialog when they fail.

THE RULE IT BREACHES, WHICH THIS PROJECT WROTE DOWN ITSELF, at `execute.ts` · the rule about a command whose effect cannot be shown (line 751): "a command whose effect cannot be shown does not get a weaker confirm -- it does not run". Here the effect cannot be shown, the confirm is quietly weakened, and the command runs.

THE CONSEQUENCE. A user approves a destructive operation on the strength of a preview that is incomplete for a reason nobody told them.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `96ab4288`. All three walks answered `[]` on a `readdirSync` failure, and `snapshot()` recorded an unreadable item file as ABSENT — which the diff draws as A REMOVAL, a confident claim about a file nobody read. The refusal is now checked BEFORE the "the copy holds no item files" count, because a partial walk can answer a non-zero count and still be missing the item the confirm is about.

That ordering is the fix, not the catch: it is the rule this project wrote down itself — a command whose effect cannot be shown does not get a weaker confirm, it does not run. 16 removals, 16 reds, 0 greens in that commit, and `test/ui/execute-effect-blind-walk.test.ts` resolves at it. Closed by the reconciliation in `rulings/93`.
