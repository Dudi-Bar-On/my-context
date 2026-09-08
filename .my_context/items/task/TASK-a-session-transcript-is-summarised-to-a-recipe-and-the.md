---
id: TASK-a-session-transcript-is-summarised-to-a-recipe-and-the
type: task
title: a session transcript is summarised to a recipe, and the recipe is settled against a real session
status: active
severity: soft
always: false
summary: Turning a long saved conversation into a short account of what was decided and tried, proved in a throwaway session rather than this one.
summary_of: bbd1b129cc9f22ca
summary_was:
  - 2026-09-07 Turning a long saved conversation into a short account of what was decided, tried and measured, without the parts that can be found elsewhere.
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 9ce347e0ec6b8437
plan: restore
seq: "1"
state: done
priority: "2"
verified_on: 2026-09-08
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

HOW THIS IS VERIFIED - OWNER RULING 2026-09-07, and it is better than what the spec first said.

THE SOURCE SESSION IS NOT THE TEST SESSION. His six steps:
  1 open a NEW TERMINAL on the same cwd
  2 create a NEW SESSION there
  3 do the injection into THAT session
  4 test whether the injection succeeded
  5 close the test session
  6 close the terminal

WHY THIS IS RIGHT AND NOT MERELY TIDY, which I had underweighted: OUR SESSION IS THE SOURCE DATA.
Injecting into it would contaminate the very transcript being summarised, and would land straight in
the loop-guard case where a summary gets summarised. His separation removes that entirely. It is also
more honest than a fixture: the same cwd means the same corpus, the same config and the same real
hooks, so the path under test is the actual one - which satisfies
INSTR-testing-happens-against-the-current-corpus-and-an-exception with no exception needed.

FOUR ADDITIONS SO THE TEST PROVES WHAT IT CLAIMS:

  1. SNAPSHOT THE SOURCE BY BYTE OFFSET FIRST. The source transcript keeps growing while the test
     runs. Record "summarise up to byte N" so the input is fixed and the run is repeatable. The
     conversation index already stores `bytes` per session and uses (bytes, mtime_ms) as its
     freshness key, so the offset is already available.

  2. STEP 4 NEEDS A REAL ANSWER. Checking that the hook printed something only proves the hook ran.
     ASK THE NEW SESSION A QUESTION ONLY THE SUMMARY COULD ANSWER - a decision taken before the last
     compaction, say. If it answers, the content reached the model. If it can only quote a heading,
     it did not. Anything less is the class of green test this project keeps catching: a screen that
     renders correctly and does nothing when used.

  3. TEST THE FAILURE CASE, AND IT IS THE IMPORTANT ONE. Clear the window WITHOUT staging and confirm
     the summary is gone. That proves the disk-first ordering is doing real work rather than being a
     comment. It is the one failure mode that loses the thing the feature exists to save.

  4. TWO RESIDUES, NAMED SO THEY DO NOT SURPRISE ANYONE. The test session writes its own transcript,
     which the archive will then index - harmless, and a small clean fixture. And its SessionStart
     hook writes a `session-start` audit row into the real corpus. Both are normal behaviour; neither
     is damage; both are writes and should be expected rather than discovered.

AND NOTICE WHAT HE HAS ACTUALLY DESCRIBED: A GENERAL HARNESS, NOT A ONE-OFF. A disposable session in
the same cwd is how ANYTHING injection-shaped should be tested - this feature, the handover, the
budget tiers, plan:contra. Today those are covered by hook-level unit tests that never open a session
at all. Whoever builds this should build it as a reusable harness and say so.

DONE 2026-09-08. src/core/session-summary.ts plus 17 tests, run against this session’s real
transcript: 26,673 records read in 533 ms.

THE FILTER IS STRUCTURAL, NOT A WHITELIST, AND THAT MATTERS: the lead named seven record types; the
file carries SEVENTEEN, ten of them not on the list. A whitelist written yesterday was already wrong
today, and wrong silently. Asking "does this record carry a message object" stays true when the
harness adds a member. 16,659 of 26,673 removed by that question alone.

A STAGE THE SPEC DID NOT HAVE, and the data demanded it: of 525 records classified as prompts, 194
are task notifications and 24 are meta. 279 turns were typed by a person - 44,006 characters, 0.07%
of a 61 MB file.

AND THE FIRST RUN PRODUCED A BROKEN SUMMARY, which is worth keeping: a global top-60 gave 45 slots to
measurements and ZERO to corrections and failures, the two categories the design calls irreplaceable.
Fixed structurally - the cap is a quota per category, not a sort - not by tuning cues.
