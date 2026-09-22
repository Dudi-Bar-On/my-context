---
id: TASK-a-windows-reaping-test-passes-or-fails-by-the-hosted-runner
type: task
title: a Windows reaping test passes or fails by the hosted runner's mood, so the suite does not tell the truth there twice in a row
status: active
severity: soft
always: false
summary: One test about killing child processes assumes the machine cleans them up a certain way; on the shared CI machine that assumption held once and failed once, so a green run there proves less than it claims.
summary_of: 7ddcac4fb9c9584f
scope: []
tags:
  - "plan:release"
  - "seq:17"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 424bb2ff6c25ec72
plan: release
seq: "17"
state: done
---

# a Windows reaping test passes or fails by the hosted runner's mood, so the suite does not tell the truth there twice in a row

Measured on CI run 35725630027: attempt 1 on windows-latest failed test/core/ui-server-upkeep.test.ts:540 (a child launched the breakaway way outlives the exact kill the platform uses, and the old shape does not) with the test's own control-arm message - the shape this change replaced must still die with its parent; if it survives, this machine is not reaping and the survival below proves nothing - and attempt 2 on the same commit (4c19d8f5) passed. The previous Windows run (b9c2f39d) passed too. Nothing in phase 1 touched the file. RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails applies: a test whose verdict depends on the runner is a defect in the test.

Closing condition: the test establishes its precondition (that the platform reaps the old shape) with a measurement it controls - waiting for the old-shape child with a bounded poll rather than a single check, or skipping with a named reason when the control arm shows the runner does not reap (the message already says the proof is void; make that a skip, not a failure) - and passes on three consecutive Windows CI attempts on one commit (gh run rerun --failed, read by the controller). Files: test/core/ui-server-upkeep.test.ts and, only if the product is at fault, src/core/ui-server-upkeep.ts.

Record, 2026-09-22 (controller): fixed in commit d1751580 (bounded 6 s poll in readPidWhenWritten's pattern; skip with the reason when the runner does not reap). CI run 35735392220 on commit 97e27289, windows-latest, three consecutive attempts: attempt 1 (13:59Z) PASS 2490 ms; attempt 2 (14:15Z) PASS 2206 ms; attempt 3 (14:35Z) PASS 2375 ms. Suite 8980 tests, 0 fail, 3 skipped each time. The poll resolved before its limit every time; no skip fired. Closing condition met.
