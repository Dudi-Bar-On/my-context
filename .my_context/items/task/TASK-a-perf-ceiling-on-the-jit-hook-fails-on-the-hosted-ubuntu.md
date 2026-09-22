---
id: TASK-a-perf-ceiling-on-the-jit-hook-fails-on-the-hosted-ubuntu
type: task
title: a perf ceiling on the JIT hook fails on the hosted Ubuntu runner once in two runs, and no baseline says which run is right
status: active
severity: soft
always: false
summary: One performance test asserts the tool answers within a fixed time; on the shared CI machine it was over the limit once and under it once, and there is no earlier record to say which is normal.
summary_of: d67aa405780c4980
scope: []
tags:
  - "plan:release"
  - "seq:18"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: d8a005874aed6faa
plan: release
seq: "18"
state: done
---

# a perf ceiling on the JIT hook fails on the hosted Ubuntu runner once in two runs, and no baseline says which run is right

Measured on CI run 35725630027: attempt 1 on ubuntu-latest failed 'the JIT hook stays under the 50ms p95 ceiling with a focus set' with p95 74.1 ms against a 50 ms ceiling (the sibling hit-path test at 5000 items passed); attempt 2 on the same commit (4c19d8f5) passed. On master test:perf has been skipped on every recent run because verify:citations was red in front of it, so no Ubuntu baseline exists. Locally the perf suite blows six ceilings on a contended machine, which is contention, not evidence. The owner's standing instruction: a ceiling is never widened without the owner's word.

Closing condition: the measurement is made trustworthy before the ceiling is judged - the test states how many samples it takes and discards a warm-up, and the controller records three consecutive Ubuntu attempts on one commit (gh run rerun --failed) in this item's observation with the p95 of each; if all three are under 50 ms the ceiling stands and the item closes; if any is over, the item records the numbers and the OWNER rules on the ceiling. Files: test/perf/ (the JIT hook file), src/hooks/ only if a real regression is found. Related: hooks/12q and TASK-five-perf-files-index-the-percentile-one-rank-high-and-their (phase 5) own the percentile arithmetic; this item is about one ceiling on one runner.

Record, 2026-09-22 (controller): the method was sound (warm-up primes module init and the glob cache; the focus path's per-call work is real), so commit acd7056b only made the test print and fail with its whole distribution; the ceiling is untouched. CI run 35735392220 on commit 97e27289, ubuntu-latest, JIT hit-path (focus set) over 200 samples against the 50 ms ceiling, three consecutive attempts: attempt 1 (13:59Z) p95 6.5 ms (min 3.3, median 4.2, max 77.1); attempt 2 (14:15Z) p95 5.0 ms (min 3.6, median 4.2, max 5.7); attempt 3 (14:35Z) p95 5.6 ms (min 4.0, median 4.6, max 12.9). All PASS. The 74.1 ms of run 35725630027 attempt 1 was the runner; the ceiling stands and no ruling is needed.
