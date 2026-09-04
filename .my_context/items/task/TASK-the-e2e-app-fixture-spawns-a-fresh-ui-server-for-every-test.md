---
id: TASK-the-e2e-app-fixture-spawns-a-fresh-ui-server-for-every-test
type: task
title: the e2e app fixture spawns a fresh UI server for every test instead of once per worker
status: active
severity: soft
always: false
summary: The browser suite starts a whole UI server and waits for authentication on every test rather than once per worker, which is most of why it is slow.
summary_of: 5e9ef87be0f3e3b3
scope:
  - e2e/app.ts
  - e2e/global-setup.ts
tags:
  - v2
  - e2e
  - walk
  - gates
  - "plan:walk"
  - "seq:133"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 2c408401e3866ff7
plan: walk
seq: "133"
state: doing
priority: "2"
---

# the e2e app fixture spawns a fresh UI server for every test instead of once per worker

Change the `app` fixture in `e2e/app.ts` from test-scoped to worker-scoped, so `startUiChild(CORPUS)` runs once per Playwright worker instead of once per test.

This is deliberately a DIFFERENT fix from `TASK-every-e2e-fixture-writes-the-index-so-parallel-workers` (plan:walk seq:79, already landed): that task moved the per-fixture `mycontext audit` WRITE into `e2e/global-setup.ts` so fixtures only read the index. This task is about the RUNTIME COST of spawning a server, opening SQLite and waiting up to 15 seconds for auth on every test — a cost per-fixture reads do not remove, since the fixture's own docblock already says 'this fixture only READS, and it must stay that way' while still starting and stopping a whole server around that read, every time.

Convert `app` to Playwright's worker-scoped fixture form (`test.extend<{}, {app: App}>`, with the server fixture in the worker-scoped second type parameter). Keep per-test navigation and the auth-wait so each test still starts from a known page state; stop the server once in worker teardown rather than in each test's `finally`.

**The caveat that makes this unsafe to do carelessly:** `serverOutput()` (`h.output()` on the harness) currently accumulates output across every test that shares one server. A worker-scoped server run across many tests will mix later tests' server output into earlier assertions unless each test computes its own DELTA against the byte length it observed when the test began. Without that, this change trades a twelve-minute runtime for a suite that intermittently sees other tests' log lines — a worse flake than the one being fixed.
