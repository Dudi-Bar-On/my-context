---
id: TASK-ui3-task-8-inherits-the-projection-rename-and-half-its-step
type: task
title: ui3 task 8 inherits the projection rename and half its step 1 is already done
status: active
severity: soft
always: false
summary: A planned test asserts a shape that no longer exists, and half the work it describes is already done.
summary_of: 9573dcbd3ec0b00c
scope: []
tags:
  - "plan:ui3"
  - "seq:8d"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 6c9354df9ca4f03f
plan: ui3
seq: 8d
state: done
priority: "1"
---

# ui3 task 8 inherits the projection rename and half its step 1 is already done

Recorded by the ask-model agent so task 8 does not assert a shape that no longer exists.

Task 8's sample E2E asserts body.projection.stateBeforeSync and the three-state set ['fresh','behind','diverged']. Both are wrong now. Tasks 6 and 7 both use the read-only door: the field is projectionState and its values are 'fresh' and 'absent', because nothing syncs - stale is reported as a 503, not carried in the body.

Also already done, so task 8 must not redo it: registerAskRoutes() is wired into server.ts and eight probes for the three ask routes are in READ_ROUTES. Neither could wait for task 8 - no-writes.test.ts fails on a src/ui/ module unreachable from server.ts, and server-e2e.test.ts fails on a registered route with no probe.

readProjection is exported from watch-model.ts and imported by ask-model.ts rather than copied, so the policy has one spelling. Task 8 should keep it that way.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: DONE, on the same evidence and for the same reason as its sibling plan:ui3 seq:7d.

  the three-state set and body.projection.stateBeforeSync were never built; the field is projectionState with values fresh and absent, because nothing syncs
  `ask-model.ts` · `import { readProjection } from './watch-model.ts';` · ~10 IMPORTS readProjection from watch-model.ts rather than copying it, which is precisely what this task asked task 8 to keep -- so the policy still has one spelling
  registerAskRoutes() is wired and its probes are in READ_ROUTES; no-writes.test.ts and server-e2e.test.ts would both fail otherwise, and both are green

Every instruction in this task was followed. It is a carrier and it has been delivered.
