---
id: TASK-no-doctor-check-reads-the-code-identity-so-an-install-that
type: task
title: no doctor check reads the code identity, so an install that cannot examine its own files has no terminal surface for it
status: active
severity: soft
always: false
summary: The console knows when it cannot tell whether it is running the code on disk, but the doctor command never asks, so a person at the terminal is never told.
summary_of: 6043e80b11c2de6a
scope: []
tags:
  - "plan:release"
  - "seq:33"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: f683fba199b6c79f
plan: release
seq: "33"
state: todo
---

# no doctor check reads the code identity, so an install that cannot examine its own files has no terminal surface for it

Found by task 4.10 on 2026-09-23 (TASK-an-install-whose-sources-cannot-be-walked-reports-its-code): src/core/code-identity.ts now carries freshness() = fresh | stale | unmeasured with the reason, and the UI banner and MCP provenance draw it, but no check under src/doctor reads CodeIdentity at all, so mycontext doctor is silent on a stale or unmeasured install. Closing condition: a doctor check reads the identity the way the UI does (one measurement, the same class), emits one finding per state that is not fresh in doctor's existing shape with the remedy (restart the server for stale; the path and errno for unmeasured), reaches both the terminal and /api/doctor, and is called the way checkCliOnPath and checkRuleStore are if the isolation registry forbids the import (test/rules/isolation.test.ts and test/doctor/registry-membership.test.ts say). Tests plant a stale tree and an unwalkable one and assert the finding on both surfaces. Files: src/doctor (new check), src/cli/commands/doctor.ts, src/ui/read-model.ts, their tests. Release phase 5.
