---
id: TASK-the-parser-decides-which-confirm-a-command-gets-and-a-gate
type: task
title: the parser decides which confirm a command gets, and a gate holds the catalogue to it
status: active
severity: soft
always: false
summary: Decide which commands need the stronger confirmation from what they really do, and keep a check that speaks up when the list drifts.
summary_of: bdc6ff7156c409a7
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - "plan:execute"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 0496d5d6f88fdace
plan: execute
seq: "2"
state: done
priority: "1"
source: owner, 2026-08-26 ruling; plan written 2026-08-27
---

# the parser decides which confirm a command gets, and a gate holds the catalogue to it

This item tracks state only. The task itself is Task 2 of docs/superpowers/plans/2026-08-27-execute-a-composed-command.md, which carries the tests, the code and the commit message. The design is docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md — read section 3 AND section 6 together; 6.1 widened 3.2.

`approvalBoundary()` derives the gated set by running the REAL argument parser with probe flags — correct, and far too expensive inside a request. So the catalogue's `boundary` flag is what the server reads and this test is what stops it being a stale list.

Combined with seq:1's fail-safe default, a command added later gets the stronger confirm whether or not anyone remembers to flag it, and this gate then says so out loud.

WATCH IT FAIL before believing it: flip one flag, see red, put it back. It may pass the moment it is written, and a gate nobody has seen fail is a gate nobody has tested.
