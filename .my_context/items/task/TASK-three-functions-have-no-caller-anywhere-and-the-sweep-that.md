---
id: TASK-three-functions-have-no-caller-anywhere-and-the-sweep-that
type: task
title: three functions have no caller anywhere, and the sweep that found them is a floor rather than a ceiling
status: active
severity: soft
always: false
summary: Three pieces of code are never used, one of them naming two users that do not exist, and the method that found them can only be trusted downwards.
summary_of: 4f04f72866d55bdb
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
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: aa7a5b831eda4c07
plan: accretion
seq: "4"
state: todo
priority: "3"
---

# three functions have no caller anywhere, and the sweep that found them is a floor rather than a ceiling

Raised by report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`, section 4 and Remove) as row 86 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Three functions with no reference anywhere -- `validateUpdatableValue`, WHOSE DOCBLOCK NAMES TWO CALLERS THAT DO NOT CALL IT; `summaryIsStale`; and `anchorSubject`. Plus six `export` keywords that expose nothing outside their own file.

AND THE LIMIT OF THE EVIDENCE, WHICH THE REPORT STATES ITSELF AND WHICH MUST NOT BE DROPPED: the dead-export sweep is A FLOOR, NOT A CEILING. It matches substrings rather than imports, so it can call a symbol "used" when only a comment mentions it -- which is exactly how these three slipped past five hand-checking lanes. A ceiling needs a type-checker API and was not attempted. So the first step of this work is to confirm each of the three by import rather than by substring.
