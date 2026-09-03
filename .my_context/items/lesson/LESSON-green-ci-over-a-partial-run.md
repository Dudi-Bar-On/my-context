---
id: LESSON-green-ci-over-a-partial-run
type: lesson
title: A test command can pass while running only part of the suite
status: active
severity: soft
always: false
summary: A test run can report success while having quietly run only half the tests, and that green result is the very signal you would use to catch it.
summary_of: f5dc491edf2c827b
scope: []
tags:
  - ci
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: b56c7e9ee8d8e6c6
---

# A test command can pass while running only part of the suite

An unquoted `**` glob in an npm script is expanded by `sh` on Linux, which without
globstar treats it as `*`. Measured: 2 of 4 test files ran, exit code 0. The failure
is invisible precisely because the signal you would use to detect it — a green run —
is what it produces.

## Observations
- [method] Assert the reported test-file count, not just the pass count #testing
