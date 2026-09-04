---
id: TASK-the-server-records-where-it-is-listening-and-takes-it-back
type: task
title: the server records where it is listening, and takes it back on exit
status: active
severity: soft
always: false
summary: The server should write down the address it actually answered on, and clear that note again when it stops.
summary_of: 60d42c414c4f2598
scope: []
tags:
  - v2
  - hooks
  - ui
  - server
  - "plan:upkeep"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 07d8fa5ef9ab39a9
plan: upkeep
seq: "2"
state: done
priority: "2"
source: owner, 2026-08-27
---

# the server records where it is listening, and takes it back on exit

This item tracks state only. The task itself is Task 2 of docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md, which carries the tests, the code and the commit message.

The recorded port must be the BOUND one, read back from `server.address()`, never the requested one: the default port is 0 and a record saying 0 would send every probe to the wrong place forever.

This is the THIRD write in `src/ui/`, a directory `test/ui/no-writes.test.ts` holds to read-only on purpose. It is outside any request path, like the other two, and it goes on that test's allow-list with the same one-line reason they carry. Do not widen the test.
