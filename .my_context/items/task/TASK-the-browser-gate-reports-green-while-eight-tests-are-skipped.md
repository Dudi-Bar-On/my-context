---
id: TASK-the-browser-gate-reports-green-while-eight-tests-are-skipped
type: task
title: the browser gate reports green while eight tests are skipped and twelve specs delete an environment variable they should restore
status: active
severity: soft
always: false
summary: The browser test run says it passed while quietly leaving out eight tests, and a dozen test files remove a setting from the environment instead of putting back what was there.
summary_of: 2b80b257edd3e81e
scope: []
tags:
  - "plan:release"
  - "seq:26"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: dc44310fa880f242
plan: release
seq: "26"
state: todo
---

# the browser gate reports green while eight tests are skipped and twelve specs delete an environment variable they should restore

Found by lane 3.9 round 3 on 2026-09-23 (the first green gate: 1394 passed, 4 retried, 8 skipped). Eight e2e tests are skipped without the gate naming them or their reason in its verdict, and twelve specs end with delete process.env.CLAUDE_CONFIG_DIR rather than restoring the prior value, so a spec run after them sees a different environment than the one they found. Closing condition: the gate prints every skipped test with its reason next to its counts (a skip without a reason is refused, the way check:basis refuses a test without a basis), and the twelve specs restore the variable to what it was; a test for the gate's skip reporting in test/scripts/e2e-gate.test.ts. Files: scripts/e2e-gate.ts, the twelve specs (the lane's report lists them), test/scripts/e2e-gate.test.ts. Release phase 6, lane group 5 (browser gates).
