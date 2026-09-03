---
id: LESSON-tests-that-cannot-fail
type: lesson
title: Several tests asserted properties they could not fail on
status: active
severity: soft
always: false
summary: Several tests were arranged so that no fault could ever make them fail, so they read as protection while checking nothing at all.
summary_of: 50e4a0f7d7b1dfdb
scope: []
tags:
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 8d8d68a7909cd45e
---

# Several tests asserted properties they could not fail on

A test named "pinned tier takes always:true regardless of scope" gave every fixture
an empty scope. One named "index stays bounded" used rationale-tier items that are
never enumerated. An "output uses LF only" fixture contained no carriage return.
Each would pass whether the code was right or wrong, while reading as coverage.

## Observations
- [method] For each test ask: what one-line change to the source would make this fail? If none, it asserts nothing #testing
- [method] Deleting a line of implementation and re-running is a cheap way to find them
