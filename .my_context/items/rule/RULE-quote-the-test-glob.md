---
id: RULE-quote-the-test-glob
type: rule
title: Keep the test glob double-quoted in package.json
status: active
severity: hard
always: false
summary: The pattern naming the test files must stay quoted in the project's own scripts, or one system runs a fraction of the tests and still reports success.
summary_of: 1e1a9d8e76492db5
scope:
  - package.json
  - .github/workflows/**
tags:
  - ci
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: a7e9af590b6a1f4e
directive: do
---

# Keep the test glob double-quoted in package.json

The script must stay `node --test "test/**/*.test.ts"`. Unquoted, `npm test` runs
through `sh` on Linux CI, which expands `**` as `*` without globstar — measured at
2 of 4 test files executed, **exit code 0**. CI reports success over half a suite.
Single quotes do not work either: cmd.exe does not strip them.

## Observations
- [symptom] A green CI matrix while most of the suite never ran #ci
- [rule] Confirm the reported test-file count matches the number of files under test/

## Relations
- derived_from [[LESSON-green-ci-over-a-partial-run]]
