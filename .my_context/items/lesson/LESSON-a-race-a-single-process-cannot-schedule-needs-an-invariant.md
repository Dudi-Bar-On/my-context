---
id: LESSON-a-race-a-single-process-cannot-schedule-needs-an-invariant
type: lesson
title: a race a single process cannot schedule needs an INVARIANT, not a timing test
status: active
severity: soft
always: false
summary: When a fault needs two things to collide and you cannot force the timing, test a property the broken version can never satisfy instead.
summary_of: 81619c333dce2fd0
scope: []
tags:
  - v2
  - testing
  - audit
  - concurrency
  - execute
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: e01257c9ae94f54f
---

# a race a single process cannot schedule needs an INVARIANT, not a timing test

MEASURED 2026-08-27, while replacing the execute route's audit rewrite with an appended pair.

THE DEFECT. `finaliseExecutionRow` stamped a run's exit code by reading the WHOLE audit log with `readFileSync`, changing one line in memory, and writing the whole file back. The log is append-only and unlocked -- `appendJsonlLine` is a bare `appendFileSync` -- and every hook writes to it, with `PreToolUse` firing on every file operation. A row appended between that read and that write is silently destroyed.

THE TEST THAT WAS SPECIFIED WOULD NOT HAVE CAUGHT IT, and the agent said so before writing a line of the fix. The brief asked for "append an unrelated audit row while the run is in flight, then assert it survived". It always survives: the rewrite read the log FRESH AFTER the run, so anything appended during the command was swept into the rewrite and kept. The removed code's own docstring said this, and it was true.

The real window is the few milliseconds between that `readFileSync` and that `writeFileSync`, and no single-process test can schedule it. A SECOND process appending across it destroyed 21 rows, then 1, then 6, on three runs.

WHAT WAS ASSERTED INSTEAD, and this is the lesson: not a timing, but an INVARIANT the defect violates unconditionally. THE LOG IS ONLY EVER EXTENDED. The test snapshots the log's bytes mid-run and requires them to still be a PREFIX of the file afterwards. An append cannot violate that whatever the interleaving; a whole-file rewrite violates it every single time, with no scheduling needed. It still names the foreign row and asserts it landed between the two halves, so the test is stronger AND deterministic.

THE GENERAL FORM. When the failure needs two things to happen in a particular order and you control only one of them, stop trying to arrange the order. Find the property the broken code cannot have -- here, "the file grows only at the end" -- and assert that. A flaky reproduction of a real race is worse than no test: it passes most of the time and teaches the next reader that the race is not there.

It also rhymes with the rule this project already holds -- a regression test is worth nothing until you have watched it fail. A test that CANNOT be made to fail on demand has not been watched fail; it has been hoped at.
