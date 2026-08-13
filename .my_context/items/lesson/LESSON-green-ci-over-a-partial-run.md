---
id: LESSON-green-ci-over-a-partial-run
type: lesson
title: A test command can pass while running only part of the suite
status: active
severity: soft
always: false
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
checksum: 419604cd3e5b74d6
---

# A test command can pass while running only part of the suite

An unquoted `**` glob in an npm script is expanded by `sh` on Linux, which without
globstar treats it as `*`. Measured: 2 of 4 test files ran, exit code 0. The failure
is invisible precisely because the signal you would use to detect it — a green run —
is what it produces.

## Observations
- [method] Assert the reported test-file count, not just the pass count #testing
