---
id: TASK-a-session-transcript-is-summarised-to-a-recipe-and-the
type: task
title: a session transcript is summarised to a recipe, and the recipe is settled against a real session
status: active
severity: soft
always: false
summary: Turning a long saved conversation into a short account of what was decided, tried and measured, without the parts that can be found elsewhere.
summary_of: 5fdc06da97522fae
scope:
  - src/core/**
  - src/cli/**
  - src/hooks/**
  - test/**
tags:
  - v2
  - archive
  - context
  - "plan:restore"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 93a2ba4821e1a90f
plan: restore
seq: "1"
state: todo
priority: "2"
---

# a session transcript is summarised to a recipe, and the recipe is settled against a real session

Design of record: docs/superpowers/specs/2026-09-07-session-summary-restore-design.md sections 4 and 7. Owner request 2026-09-07.

THE MECHANICAL FILTER IS FREE AND LARGE, and it is measured, not estimated: of the 24,757 records in
the owner own session, 15,788 CARRY NO message OBJECT AT ALL - attachment, system, ai-title,
file-history-snapshot, last-prompt, mode, queue-operation. That is 64% of the file removed by a test
on record TYPE, before anything semantic happens. Everything else operates on the remaining 36%.
The same 15,788 are why the archive list shows 8,969 classified records against 24,757 total; the
two features share this measurement and must not measure it twice.

THE HYPOTHESIS FOR WHAT TO KEEP, stated as a hypothesis because that is what it is. KEEP: decisions
and their REASONS (the reason is what cannot be recovered from the code); CORRECTIONS - "I was wrong
about X" - because a lost correction is a mistake that will be made again, and this session made
four; MEASUREMENTS with what was counted; unresolved questions and who they wait on; and what was
TRIED AND FAILED, which is the most expensive thing to rediscover. SKIP: tool outputs (reproducible),
code and file contents (already on disk, and a copy goes stale), anything the corpus already holds
(items are injected on their own account), and process narration.

OPTIONS, because one recipe will not fit every emergency: RANGE (whole session, or from a compaction
boundary / timestamp / message), SUBJECTS (all, or named), DEPTH (numbered points only, or points
plus reasoning), and INCLUDE CODE - off by default, on when the lost thing IS code that exists
nowhere else, such as a reverted patch or a command that worked.

SETTLE THE RECIPE BY RUNNING IT, NOT BY ARGUING. Build it, run it against THIS session - 51.3 MB,
24,757 records, a compaction already behind it - and have the owner read the numbered points and say
what is missing. This session is the ideal test case and will not be available forever, which is why
the reader is worth building before the injection half.

AND USE THE ARCHIVE SCANNER, DO NOT WRITE A SECOND ONE. plan:archive seq:1 already indexes every
transcript on disk. A second scanner over the same JSONL would drift from the first, which is the
failure this entire day has been about.
