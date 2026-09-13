---
id: TASK-the-capture-screen-demonstrates-a-command-with-every-flag-at
type: task
title: the Capture screen demonstrates a command with every flag at once on one unwrapped 600-character line
status: active
severity: soft
always: false
summary: The teaching screen shows one enormous command line using every option at once, which is a reference rather than an example.
summary_of: f6ad928f692d4175
scope:
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - teaching
  - example
  - "plan:walk"
  - "seq:159"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: ed334239408a06a7
plan: walk
seq: "159"
state: todo
priority: "3"
---

# the Capture screen demonstrates a command with every flag at once on one unwrapped 600-character line

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 7.4) as row 118 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The Capture screen demonstrates `mycontext add` WITH EVERY FLAG PRESENT AT ONCE, on a single unwrapped 600-character line.

WHY IT IS A DEFECT AND NOT A STYLE NOTE. That is a REFERENCE, not an EXAMPLE. Both UI reviews singled out this product's teaching copy as its real differentiator -- "the first to fail is the answer: above passed, below never reached"; "a guess that resolves is worse than silence" -- and this is the one place where the teaching surface shows the reader everything at once instead of the thing they came for.

RELATED: row 58 records that the flag summaries are hand-kept and drifted; a worked example derived from the same table would not drift either.
