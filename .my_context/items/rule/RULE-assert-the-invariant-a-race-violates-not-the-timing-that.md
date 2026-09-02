---
id: RULE-assert-the-invariant-a-race-violates-not-the-timing-that
type: rule
title: Assert the invariant a race violates, not the timing that exposes it
status: active
severity: hard
always: false
summary: When a bug depends on unlucky timing you cannot arrange, test the rule it breaks instead; a test that only sometimes fails teaches people the bug is not there.
summary_of: f4977d7f43957c27
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: cd7fe0aff8af0f74
directive: do
---

# Assert the invariant a race violates, not the timing that exposes it

When a failure needs two things to happen in a particular order and the test controls only one of them, arranging the order is not possible — a single process cannot schedule the window between another writer's read and its write. A test that tries produces a reproduction that succeeds sometimes, and a test that succeeds sometimes is worse than none: it passes most of the time and teaches the next reader the race is not there.

The alternative is to find the property the broken code cannot have, whatever the interleaving, and assert that. "The file is only ever extended" is violated by a whole-file rewrite every single time and by an append never, with no scheduling required — so it is both stronger and deterministic.

This also satisfies the rule that a regression test is worth nothing until it has been watched fail: a test that CANNOT be made to fail on demand has not been watched fail, it has been hoped at.

## Relations
- derived_from [[LESSON-a-race-a-single-process-cannot-schedule-needs-an-invariant]]
