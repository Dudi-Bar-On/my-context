---
id: TASK-the-real-home-guard-cannot-tell-a-test-write-from-the
type: task
title: the real-home guard cannot tell a test write from the developer running the product
status: active
severity: soft
always: false
summary: A safety check watching a shared folder blames tests for files that a developer's own running app wrote.
summary_of: fc07dffb337761e8
scope: []
tags:
  - "plan:port"
  - "seq:13b"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 2ba79b13294aa7c5
state: done
plan: port
seq: 13b
---

# the real-home guard cannot tell a test write from the developer running the product

Filed 2026-08-23, the day the guard landed (plan:port seq:13), because two agents hit it in the same afternoon and neither could tell at first whether it was a real catch.

WHAT THE GUARD DOES, and it is the right mechanism: it snapshots the real `~/.my-context` before any test runs and fails the test that changed it. It compares the DIRECTORY rather than intercepting `fs`, deliberately - the suite spawns children with no `--import`, and a child loads none of the suite's code, so an fs patch cannot see the one case that matters. That reasoning is sound and should not be undone.

THE BLIND SPOT is the same property seen from the other side: the filesystem is shared by every process on the machine, so the guard cannot tell WHO wrote. A developer running `mycontext ui` in another terminal writes `ui-sessions.json` into that exact directory - correct, intended production behaviour - and a suite running at the same time reports it as contamination, naming whichever test happened to be running.

MEASURED: one loaded run produced 17 real-home-guard failures from `ui-sessions.json` being written while a UI server was serving the demo corpus in another window. The agent that hit it spent time deciding whether it was its own defect. A guard that cries wolf on the developer's own product is a guard that gets switched off - which is precisely how the convention it replaced failed.

WHAT WOULD SETTLE IT, ranked. (1) Ignore the files the product legitimately writes there during a normal run - `ui-sessions.json` is the only one today - and say in the failure that the ignore list exists. Cheap, and it keeps the guard's reach over everything that matters, which is items and config. (2) Compare CONTENT identity rather than presence for those files, so an eviction is tolerated but an item file is not. (3) Have the guard report the writing pid where the platform allows it - the most informative and by far the most work.

Recommendation is (1), with the reason written into the failure text so the next reader does not have to rediscover this item.
