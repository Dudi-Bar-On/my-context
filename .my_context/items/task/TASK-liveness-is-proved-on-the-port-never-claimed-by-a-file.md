---
id: TASK-liveness-is-proved-on-the-port-never-claimed-by-a-file
type: task
title: liveness is proved on the port, never claimed by a file
status: active
severity: soft
always: false
summary: Decide whether the local server is really running by trying to connect to it, never by trusting a file that merely says so.
summary_of: e663caf971cef485
scope: []
tags:
  - v2
  - hooks
  - ui
  - server
  - "plan:upkeep"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 52f23368d7cdf045
plan: upkeep
seq: "3"
state: done
priority: "2"
source: owner, 2026-08-27
---

# liveness is proved on the port, never claimed by a file

This item tracks state only. The task itself is Task 3 of docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md, which carries the tests, the code and the commit message.

Three steps, and only the third decides: the record parses, the pid is alive, a TCP connect to the port succeeds. A record that fails step 2 or 3 is stale and is REMOVED.

The pid check is cheap and catches the common case, and it is NOT sufficient — pids are reused. Believing the file is exactly the shape of the audit projection that said the corpus was loading for nine days. Measure the thing, not its proxy.

Bounded hard: this runs on a hook the platform waits for.
