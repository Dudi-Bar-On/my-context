---
id: TASK-the-audit-log-still-records-two-session-ids-that-never
type: task
title: the audit log still records two session ids that never existed
status: active
severity: soft
always: false
summary: A test that must run the real subagent door against the real repository writes injection records under synthetic session ids, so the owner's audit stream shows lanes that never ran.
summary_of: 54ef3261b35c433f
scope:
  - src/core/audit.ts
  - src/core/inject.ts
  - test/rules/**
  - .my_context/.audit/**
tags:
  - v2
  - store
  - "plan:rulings"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-12
valid_until: null
checksum: b2ef6aeb3654e3dd
---

# the audit log still records two session ids that never existed

> MEASURED 2026-09-13, while closing `TASK-more-than-half-the-delivery-log-is-tests-and-the-file-has-no` (plan:rulings seq:71). That item fixed the DELIVERY record; this is the same pollution arriving in the other log, and it was made visible by the same join.
>
> WHAT IS THERE. `.my_context/.audit/` holds injection records under two session ids that no session ever had: `lane-still-gets-the-no-git-rule` (agent `proof`) and `eyeball`. They are written by `test/rules/lane-still-gets-the-no-git-rule.test.ts`, whose last assertion calls `buildSubagentStartOutput({ session_id: 'lane-still-gets-the-no-git-rule', agent_id: 'proof', cwd: REPO }, REPO)` against the REAL repository - which is the whole point of that file and must not change, because `workspaceIsMyContext` puts the developer tier in force in exactly one directory on the machine.
>
> WHY IT MATTERS AND HOW IT SHOWED UP. Joining `.rules/delivered.jsonl` against the audit log's `subagent-start` records on the key `sessionId::agent`, the two synthetic ids are now the ONLY audit keys with no delivery row - they are the residue of exactly the same defect, one log over. `mycontext audit` and the UI's watch screen read this stream, so the synthetic ids are visible to a person as though a lane called `eyeball` had once run here.
>
> WHAT THE FIX LOOKS LIKE, AND WHY IT IS NOT THE SAME ONE. `src/rules/delivered.ts` now forks its record on `NODE_TEST_CONTEXT` (`isTestProcess` / `deliveredFile`) - a signal Node's test runner sets, inherited by every child a test spawns, that no caller can forget to send. The audit writer is `src/core/audit.ts` / `src/core/inject.ts`, which `src/rules/` may not import (`test/rules/isolation.test.ts` walks the import graph), so the same predicate cannot simply be reused across the boundary; it would have to be stated a second time on the core side. THAT IS THE DECISION THIS ITEM IS FOR: one predicate duplicated in two modules that may not see each other, versus leaving a handful of synthetic rows in a log a person reads. Deliberately left unfixed rather than fixed badly while closing a different item.
>
> SCOPE NOTE. This is about the RECORD, never the delivery: the door has to keep running for real against the real store, for the reason that test file's own header spends a section on.
