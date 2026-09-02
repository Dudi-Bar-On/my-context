---
id: TASK-one-node-test-failed-once-in-three-consecutive-runs-and-was
type: task
title: one node test failed once in three consecutive runs and was not identified
status: active
severity: soft
always: false
summary: A test failed once and passed twice, and nobody caught which one; find it rather than trusting the green run.
summary_of: 195b4ed7796e5ba2
scope: []
tags:
  - "plan:port"
  - "seq:10"
  - v2
  - quality
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 85ddfaef8cc07eb2
plan: port
seq: "10"
state: done
---

# one node test failed once in three consecutive runs and was not identified

On 2026-08-22, after merging ui3 11, npm test reported 3829 pass 1 fail; two further runs reported 3830 pass 0 fail and the failing name was not captured. A flake in a suite with no retries is not noise - this project treats a test that passes on the second attempt as a test that has told you something. Re-run with output captured to a file until it reproduces, then fix the test rather than the symptom. Recorded so it is not forgotten simply because the next run was green.
