---
id: TASK-a-perf-ceiling-on-the-jit-hook-fails-on-the-hosted-ubuntu
type: task
title: a perf ceiling on the JIT hook fails on the hosted Ubuntu runner once in two runs, and no baseline says which run is right
status: active
severity: soft
always: false
summary: One performance test asserts the tool answers within a fixed time; on the shared CI machine it was over the limit once and under it once, and there is no earlier record to say which is normal.
summary_of: c754326ec3d8bcf5
scope: []
tags:
  - "plan:release"
  - "seq:18"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 72714088f6f1acbb
plan: release
seq: "18"
state: doing
---

# a perf ceiling on the JIT hook fails on the hosted Ubuntu runner once in two runs, and no baseline says which run is right

Measured on CI run 35725630027: attempt 1 on ubuntu-latest failed 'the JIT hook stays under the 50ms p95 ceiling with a focus set' with p95 74.1 ms against a 50 ms ceiling (the sibling hit-path test at 5000 items passed); attempt 2 on the same commit (4c19d8f5) passed. On master test:perf has been skipped on every recent run because verify:citations was red in front of it, so no Ubuntu baseline exists. Locally the perf suite blows six ceilings on a contended machine, which is contention, not evidence. The owner's standing instruction: a ceiling is never widened without the owner's word.

Closing condition: the measurement is made trustworthy before the ceiling is judged - the test states how many samples it takes and discards a warm-up, and the controller records three consecutive Ubuntu attempts on one commit (gh run rerun --failed) in this item's observation with the p95 of each; if all three are under 50 ms the ceiling stands and the item closes; if any is over, the item records the numbers and the OWNER rules on the ceiling. Files: test/perf/ (the JIT hook file), src/hooks/ only if a real regression is found. Related: hooks/12q and TASK-five-perf-files-index-the-percentile-one-rank-high-and-their (phase 5) own the percentile arithmetic; this item is about one ceiling on one runner.
