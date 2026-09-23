---
id: TASK-d70-closed-all-five-instances-and-never-built-the-gate-the
type: task
title: D70 closed all five instances and never built the gate the same report proposed for them
status: active
severity: soft
always: false
summary: Six functions report whether they managed to write, the five known callers that ignored the answer were fixed, and nothing stops the seventh caller ignoring it.
summary_of: c6b53f0617b574e9
scope:
  - test/**
  - src/core/**
tags:
  - v2
  - gates
  - silent-failure
  - "plan:unread"
  - "seq:6"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 026890b3b0f38f9c
plan: unread
seq: "6"
state: doing
priority: "2"
---

# D70 closed all five instances and never built the gate the same report proposed for them

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`) closed its pattern P2 with a gate. The consolidation carried the five INSTANCES into rows 3, 32, 34, 35 and 37, which became `unread/1` to `unread/5` - ALL FIVE ARE NOW DONE - and carried the gate nowhere. Found 2026-09-15 by the audit at `rulings/90`; verified absent by searching `test/` for any check that binds call sites of these producers.

WHAT REPORT 3 PROPOSED, quoted: "The gate: these are six named functions. A test asserting that every call site of each one binds the result is a grep with an allowlist, in the idiom of `test/ui/no-writes.test.ts`."

THE SIX PRODUCERS, from report 3s own table, so the gate does not have to re-derive them: `core/audit.ts` `recordAudit`; `rules/delivered.ts` `recordDelivery` reached through `deliverAtDoor.recorded`; `core/review-counter.ts` `bumpCounter`; `core/ui-server-upkeep.ts` `writeState`; `review/declined.ts` `recordDecline`; `lesson/staging.ts` `readStagingDir`.

WHY THIS ITEM EXISTS AT ALL, and it is the reason to read it before deciding it is small. D70 IS 5 OF 5 DONE AND THEREFORE READS AS FINISHED. The subject is "a returned failure flag with no reader"; what closed is five readers, not the subject. `recordAudit` alone had fourteen unbinding call sites at the time of the review and only three were argued load-bearing - a fifteenth arrives with the next hook.

AND THE IDIOM IS ALREADY IN THE TREE. `test/ui/no-writes.test.ts` fails on any `node:fs` name in neither the write nor the read set, with "an unclassified API is read as harmless". That is the shape. It must fail CLOSED on an unrecognised call site, per `rulings/85`.
