---
id: TASK-perf-every-ceiling-in-the-perf-file-is-a-max-of-20-not-a-p95
type: task
title: "perf: every ceiling in the perf file is a max-of-20, not a p95"
status: active
severity: soft
always: false
summary: Speed limits labelled as a typical case are really a worst case, so one hiccup fails the run; three test files still do this.
summary_of: 1282604d0723bca1
acknowledged:
  - citation_form@b7d01675bb92ee52
scope: []
tags:
  - "plan:hooks"
  - "seq:12p"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: ccff82f6519b9c94
plan: hooks
seq: 12p
state: done
priority: "2"
---

# perf: every ceiling in the perf file is a max-of-20, not a p95

Found while adding the sweep measurement to test/perf/session-start-latency.perf.ts, and deliberately left alone there because changing it would silently re-baseline every ceiling in the file.

With ITERATIONS = 20, p95 computes floor(20 * 0.95) = 19, which indexes the last element of a sorted 20-sample array. So every assertion the file calls a p95 is in fact a maximum of twenty. One GC pause or one disk stall reddens it - observed directly, with p95 and max reported as the identical 5167.7ms.

This is why the perf file is described as failing locally and passing on CI: it is not tolerant of a single outlier by construction, and CI is quiet where a development box is not.

Two ways out, both cheap: raise ITERATIONS so the 95th percentile has samples beneath it, or say max where the file says p95. The second is free and honest; the first changes what the numbers mean. Whoever takes it must re-derive every recorded ceiling in the same commit, because the current ones were set against a max.

VERIFIED PARTIAL 2026-08-26. The file this task was WRITTEN IN is fixed: `session-start-latency.perf.ts` · `const ITERATIONS = 100;` · ~206 now runs ITERATIONS = 100. THREE SIBLINGS STILL CARRY THE IDENTICAL DEFECT and still call it p95: subagent-start-latency.perf.ts (ITERATIONS = 20 at :116, Math.floor(20 * 0.95) = index 19 = the MAX, asserted as a "500ms p95 ceiling" at :152), and the same shape in session-end-latency.perf.ts:135/156 and post-compact-latency.perf.ts:95/113. Three ceilings are misnamed.
