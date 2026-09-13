---
id: TASK-twenty-one-one-line-swallows-where-the-docstring-asserts
type: task
title: twenty-one one-line swallows where the docstring asserts what the code does not do
status: active
severity: soft
always: false
summary: In twenty-one places the comment promises the code will report a problem and the code quietly reports success instead.
summary_of: 1b9243198d28184c
scope:
  - src/core/**
  - src/ui/**
  - src/cli/**
tags:
  - v2
  - core
  - silent-failure
  - pattern
  - "plan:swallow"
  - "seq:11"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 996098f800b82f18
plan: swallow
seq: "11"
state: todo
priority: "3"
---

# twenty-one one-line swallows where the docstring asserts what the code does not do

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m1 through m19) as row 109 of `reports/2026-09-13-the-consolidated-findings.md`. TWENTY-ONE FURTHER ONE-LINE SWALLOWS, each one a place where the docstring asserts what the code does not do. The named ones:

- `readCarryOnce` -- the comment says "and says so"; the code returns `error: null`.
- `ui-sessions` -- the comment says "`error` is non-null only when a file EXISTS"; it is not.
- `isTorn` returns "not torn" for a file it could not `stat`.
- `clearFocus` says "there was nothing to remove" when it could not look.
- `decay.ts` · the renamed-category branch (line 103) makes a renamed category not-normative.
- Sixteen more of the same shape.

WHY ONE ITEM RATHER THAN TWENTY-ONE. They are the same defect and the same fix, and they were found as one pattern -- report 3's P1, a `catch` wider than the case it argues. Splitting them would hide that the argument for doing it right is already written at every one of the twenty-one sites.

A WORKED EXAMPLE EXISTS IN THE TREE, and report 3 names it: `corpus-identity.ts`'s `UNREADABLE = -1` and `context-occupancy.ts`'s missing `percent` field -- MAKE THE ZERO UNREPRESENTABLE, not merely discouraged.
