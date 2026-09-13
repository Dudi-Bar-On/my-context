---
id: TASK-two-commands-exit-zero-for-work-that-was-entirely-refused
type: task
title: two commands exit zero for work that was entirely refused
status: active
severity: soft
always: false
summary: Two commands report success when nothing they were asked to do actually happened, so a script that only checks the result code is told the work landed.
summary_of: f9ca613b621c2e89
scope:
  - src/cli/commands/ingest.ts
  - src/cli/commands/pack.ts
tags:
  - v2
  - cli
  - exit-code
  - "plan:cliscript"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: bdfd27babb4dff86
plan: cliscript
seq: "1"
state: todo
priority: "2"
---

# two commands exit zero for work that was entirely refused

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M24) as row 45 of `reports/2026-09-13-the-consolidated-findings.md`.

TWO EXIT CODES THAT SAY "DONE" FOR WORK THAT WAS NOT DONE:
- `ingest` returns 0 when EVERY candidate was rejected.
- `pack import` returns 0 on `overwriteBlocked` -- the case the product itself describes as "item(s) that differ in a field no write path here can reach".

THE CONSEQUENCE FOR A SCRIPT. The whole point of an exit code is that a caller who reads nothing else can act on it. Both of these tell a caller the work landed when nothing landed, and in the `pack import` case the refusal is one the product considers serious enough to name.

THE SUBJECT. The CLI is the surface a script and an agent talk to. What it says on the exit code, on stdout, and in its usage has to be true for a reader that never sees the prose.
