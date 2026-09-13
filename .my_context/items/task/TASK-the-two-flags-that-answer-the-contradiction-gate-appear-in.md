---
id: TASK-the-two-flags-that-answer-the-contradiction-gate-appear-in
type: task
title: the two flags that answer the contradiction gate appear in no usage, banner or help
status: active
severity: soft
always: false
summary: When the tool blocks a change and asks you to settle a conflict, the two ways to settle it are not mentioned anywhere you would look.
summary_of: 5fe0f843c7f5d693
scope:
  - src/cli/commands/edit.ts
  - src/cli/index.ts
tags:
  - v2
  - cli
  - contradiction-gate
  - discoverability
  - "plan:contra"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: a0bb9ddb14b6c78e
plan: contra
seq: "5"
state: todo
priority: "2"
---

# the two flags that answer the contradiction gate appear in no usage, banner or help

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C2) as row 60 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `edit --distinct` and `edit --supersedes` -- THE TWO FLAGS THAT ANSWER THE CONTRADICTION GATE -- are accepted, parsed and honoured, and appear in no `USAGE`, no banner and no `--help`.

WHY THAT IS WORSE THAN AN ORDINARY UNDOCUMENTED FLAG. The contradiction gate stops a writer and tells them to settle the contradiction. The two ways to settle it are invisible unless you read the source. A gate whose remedy is undiscoverable trains people to work around the gate.

THE SUBJECT. D33 is the contradiction gate itself; this is its remedy being unreachable from any surface the gate's own audience reads.
