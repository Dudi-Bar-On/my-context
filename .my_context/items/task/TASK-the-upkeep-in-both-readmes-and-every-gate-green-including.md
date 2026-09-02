---
id: TASK-the-upkeep-in-both-readmes-and-every-gate-green-including
type: task
title: the upkeep in both READMEs, and every gate green including e2e
status: active
severity: soft
always: false
summary: Document the four things about the longer-lived web server in both guides, and get every check green.
summary_of: 539f2066ced07807
scope: []
tags:
  - v2
  - hooks
  - ui
  - server
  - docs
  - "plan:upkeep"
  - "seq:6"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 19a237306940f239
plan: upkeep
seq: "6"
state: done
priority: "3"
source: owner, 2026-08-27
---

# the upkeep in both READMEs, and every gate green including e2e

This item tracks state only. The task itself is Task 6 of docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md, which carries the tests, the code and the commit message.

Four things: `ui.port` is the opt-in, `ui.enabled` is the off switch and now does something, the server returns within a minute of dying, and an already-open tab survives the restart because previously issued session digests are honoured — which is `ui-sessions.json` behaving as built, finally with a second caller.

STOP EVERY SERVER YOU HAVE RUNNING before the e2e gate. It spins its own over the same `.demo-corpus`, and two servers over one fixture produce failures belonging to nobody. That cost two red runs on 2026-08-26 and they were nearly filed as flakes.
