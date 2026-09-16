---
id: TASK-three-functions-have-no-caller-anywhere-and-the-sweep-that
type: task
title: three functions have no caller anywhere, and the sweep that found them is a floor rather than a ceiling
status: active
severity: soft
always: false
summary: Two functions nothing anywhere called have been deleted, and the one that stays now says truthfully why it has no caller.
summary_of: 15d17ff379a5a557
summary_was:
  - 2026-09-16 Three pieces of code are never used, one of them naming two users that do not exist, and the method that found them can only be trusted downwards.
scope:
  - src/core/**
  - src/cli/**
tags:
  - v2
  - core
  - dead-code
  - accretion
  - "plan:accretion"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5f87abb742697793
plan: accretion
seq: "4"
state: done
priority: "3"
verified_on: 2026-09-16
---

# three functions have no caller anywhere, and the sweep that found them is a floor rather than a ceiling

Raised by report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`, section 4 and Remove) as row 86 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Three functions with no reference anywhere -- `validateUpdatableValue`, WHOSE DOCBLOCK NAMES TWO CALLERS THAT DO NOT CALL IT; `summaryIsStale`; and `anchorSubject`. Plus six `export` keywords that expose nothing outside their own file.

AND THE LIMIT OF THE EVIDENCE, WHICH THE REPORT STATES ITSELF AND WHICH MUST NOT BE DROPPED: the dead-export sweep is A FLOOR, NOT A CEILING. It matches substrings rather than imports, so it can call a symbol "used" when only a comment mentions it -- which is exactly how these three slipped past five hand-checking lanes. A ceiling needs a type-checker API and was not attempted. So the first step of this work is to confirm each of the three by import rather than by substring.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `aebc76f0`. Two deleted, one kept. `validateUpdatableValue` is the opposite of the deliberate shape — its docblock CLAIMED two callers that refuse inline, where an unwired-by-ruling module states its ruling and this one stated a falsehood. `anchorSubject` stays: `review/drift.ts` is imported by nothing and its header already says so by owner ruling.

THE ITEM'S OWN NUMBER WAS WRONG AND THE CORRECTION IS THE RESIDUE: "six export keywords" is really about 550, reported and deliberately not acted on, because a sweep of 550 is a different item from a sweep of six. Closed by the reconciliation in `rulings/93`.
