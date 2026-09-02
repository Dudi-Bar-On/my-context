---
id: TASK-post-api-execute-takes-an-id-and-a-nonce-and-runs-execfile
type: task
title: POST /api/execute takes an id and a nonce, and runs execFile with no shell
status: active
severity: soft
always: false
summary: "Let the page actually run a command it composed, safely: no shell involved, and nothing runs unless it was recorded first."
summary_of: 18ab2860739f5507
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - "plan:execute"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: df9ea19cab0fe267
plan: execute
seq: "5"
state: done
priority: "1"
source: owner, 2026-08-26 ruling; plan written 2026-08-27
---

# POST /api/execute takes an id and a nonce, and runs execFile with no shell

This item tracks state only. The task itself is Task 5 of docs/superpowers/plans/2026-08-27-execute-a-composed-command.md, which carries the tests, the code and the commit message. The design is docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md — read section 3 AND section 6 together; 6.1 widened 3.2.

The ORDER inside the handler is the whole security story: refuse an unexpected body key (an `argv` in the body is a 400, asserted — the day the server ignores it quietly is the day someone relies on it), resolve from the catalogue, THEN redeem the nonce against the argv the SERVER built, then write the audit row, then run.

A RUN THAT CANNOT BE RECORDED DOES NOT HAPPEN — the audit write precedes execution and its failure aborts with 500. A non-zero exit is reported rather than swallowed: a refusal is a state to leave. A command that outlives the run timeout is killed and recorded as killed.

`execFile` with an argv array. Not `exec`, not `shell: true`, not a template string. The nonce store is per server, never module-global: two servers in one test process must not authorise each other's runs.
