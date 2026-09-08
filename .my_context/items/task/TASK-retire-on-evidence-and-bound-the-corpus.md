---
id: TASK-retire-on-evidence-and-bound-the-corpus
type: task
title: retire on evidence, and bound the corpus
status: active
severity: soft
always: false
summary: Remove suggestions that were never used, based on whether they were ever needed rather than on how old they are, and stop the collection growing without limit.
summary_of: 46a3877ba5a9b0bf
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 8ab417a1ce9bc7f2
plan: loop
seq: "5"
state: todo
priority: "2"
needs: loop/4
---

# retire on evidence, and bound the corpus

D36e. Plan: docs/superpowers/plans/2026-09-08-self-improvement-retirement.md. Spec sections 9 and 15.

ITS FIRST TASK WRITES NO CODE AT ALL, and that is the point: a threshold copied from a paper is the
failure mode this phase exists to prevent. Badly tuned retirement measured WORSE THAN NO RETIREMENT -
-0.019 against a 0.258 baseline. So the thresholds are DERIVED from this corpus’s own measured
distribution and written down with the date they were derived.

CALENDAR AGE IS UNCORRELATED WITH WHETHER AN ITEM HELPS, so the first draft’s "auto-deprecate after N
days" is gone. An item filed last week that has not been delivered has not failed - it has not been
tested.

NEVER DELETE ON NEGLECT. Ignoring is the absence of judgement; declining is judgement. Only judgement
earns deletion. And never touch origin:human, under any path, pinned by a test.

TASK 4 IS THE ONE THE WHOLE DESIGN EXISTS TO MAKE POSSIBLE and the one most likely to be skipped once
everything is green: re-measure and say whether it worked. A report concluding "no measurable effect"
is a SUCCESS for that task. A report concluding "it is working" without a comparison is a failure of
it. And it must be willing to recommend switching the whole thing off.

DO NOT START until the baseline has at least a month of records behind it. A threshold derived from a
week is a threshold derived from noise.
