---
id: DEC-moved-commit-with-a-pathspec
type: decision
title: the dispatching session commits by explicit path, never by the shared index — moved into the product rule store
status: active
severity: soft
always: false
summary: This rule now lives in the tool itself rather than in this project's notes, and this record says where to read it.
summary_of: 2ed5945876fae6be
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 0b62bbd64ed1d27b
---

# the dispatching session commits by explicit path, never by the shared index — moved into the product rule store

This rule is no longer maintained in this corpus. It is now the product rule store entry
`commit-with-a-pathspec`, at `src/rules/entries/commit-with-a-pathspec.md`, which ships
inside the package and is delivered at every door an agent starts through.

Read it with `mycontext rules show commit-with-a-pathspec`.

It was retired here rather than copied, because a copy cannot be superseded and only the
original can — the finding `CLAUDE.md` opens with, measured on 2026-09-07 when five
superseded instructions were being acted on as current.

## Observations
- [supersession] Replaces LESSON-stage-what-an-agent-reported-touching-not-what-you-told-it: it moved into the product rule store as `commit-with-a-pathspec` — read it with `mycontext rules show commit-with-a-pathspec`. One copy, not two: a copy cannot be superseded and only the original can.

## Relations
- supersedes [[LESSON-stage-what-an-agent-reported-touching-not-what-you-told-it]]
