---
id: TASK-ui3-task-7-carries-the-same-read-that-writes-defect-task-6
type: task
title: ui3 task 7 carries the same read-that-writes defect task 6 just corrected
status: active
severity: soft
always: false
summary: A planned route would create and change files just by being read; the fix already exists next door and must be copied over.
summary_of: 0c9314bb68cac8e7
scope: []
tags:
  - "plan:ui3"
  - "seq:7d"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 36231ce023318088
plan: ui3
seq: 7d
state: done
priority: "1"
---

# ui3 task 7 carries the same read-that-writes defect task 6 just corrected

Task 6 found that the plan's three watch endpoints, as written, would CREATE the audit database on a GET: openProjection calls ensureLogDir, creates the file when missing, sets WAL, runs twelve CREATE IF NOT EXISTS per open, and rmSyncs the file plus both sidecars on any failure; syncProjection inserts and, on diverged, deletes every row first. The e2e test 'the read surface changes not one byte of the corpus' fails on exactly that.

It used openProjectionReadOnlyChecked instead - the read-only door that shipped after the plan was written and whose own docblock names these routes.

Task 7's sample carries the identical defect for /api/ask/audit and /api/ask/summary, including the projection: { stateBeforeSync, syncedAt } shape, which asserts a sync that must not happen. Task 6's body now records the correction where task 7's agent will read it.

Three consequences task 7 inherits: stale is REPORTED and never repaired (503 naming which state); never-built is the EMPTY state and not a fault (200 with no columns, never 120 columns of zero, which is a flat chart asserting nothing happened over a log the endpoint has not read); and the field is projectionState, not projectionStateBeforeSync, because nothing syncs.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: DONE. It was a warning written for the agent who would build ui3 task 7, and that agent read it -- which is verifiable in the code rather than assumed:

  `stateBeforeSync` appears NOWHERE in src/. The shape this task warned against was never built.
  `projectionState` is the field, six occurrences each in watch-model.ts and ask-model.ts.
  `watch-model.ts` · `db = openProjectionReadOnlyChecked(root);` · ~211 opens with openProjectionReadOnlyChecked -- the read-only door, not openProjection.
  test/ui/no-writes.test.ts and the e2e assertion "the read surface changes not one byte of the corpus" are both green.

A CARRIER TASK CLOSES WHEN WHAT IT CARRIED ARRIVED. Leaving it open costs a later reader a full investigation to discover the warning was heeded.
