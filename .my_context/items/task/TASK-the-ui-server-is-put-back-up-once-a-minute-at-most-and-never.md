---
id: TASK-the-ui-server-is-put-back-up-once-a-minute-at-most-and-never
type: task
title: the UI server is put back up, once a minute at most and never a storm
status: active
severity: soft
always: false
summary: Bring the web view's server back after it dies, slowly and only a few times, then give up out loud rather than retrying forever.
summary_of: 24a78b33e2159748
scope: []
tags:
  - v2
  - hooks
  - ui
  - server
  - "plan:upkeep"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 38f3b28cf139305e
plan: upkeep
seq: "5"
state: done
priority: "2"
source: owner, 2026-08-27
---

# the UI server is put back up, once a minute at most and never a storm

This item tracks state only. The task itself is Task 5 of docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md, which carries the tests, the code and the commit message.

TWO intervals, because two different things are being bounded, and conflating them is how this kind of mechanism overloads a machine.

The PROBE runs on Stop, floored at 60 seconds — derived from how long the owner would sit looking at a dead tab, NOT from `IDLE_MS`, which is eight hours and would give a mechanism that is never there when it is wanted. The SPAWN is the expensive and dangerous act: at most one per five minutes, and after three consecutive failures it stands down for the session and says so once. A refusal is a state to leave.

`detached` and `unref` are not optional — Stop's 3-second timeout is one the platform genuinely waits on. And a spawn counts as FAILED when the next probe still finds nothing, not when `spawn` throws: a detached child that dies a second later throws nothing, and that is the failure the counter is for.
