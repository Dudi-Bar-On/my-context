---
id: TASK-a-liveness-record-for-the-ui-server-in-the-global-directory
type: task
title: a liveness record for the UI server, in the global directory
status: active
severity: soft
always: false
summary: A small file kept outside the project recording whether the local web server is running, so a later session can find it instead of starting another.
summary_of: 149aaf5909407587
scope: []
tags:
  - v2
  - hooks
  - ui
  - server
  - "plan:upkeep"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 2853890f5d4a1181
plan: upkeep
seq: "1"
state: done
priority: "2"
source: owner, 2026-08-27
---

# a liveness record for the UI server, in the global directory

This item tracks state only. The task itself is Task 1 of docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md, which carries the tests, the code and the commit message.

`~/.my-context/ui-server.json`, beside `ui-sessions.json` and for the same reason: this is MACHINE state, not corpus state, and a pid committed to git means something else on the next machine.

Follow `src/core/ui-sessions.ts` exactly — same directory, same tmp-plus-rename, same never-throw posture on a read. A record that does not parse, carries another version, or is missing a field is `null`: this file is a hint, and a hint that cannot be understood is no hint.
