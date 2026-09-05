---
id: TASK-the-mockup-catches-up-with-preview-whyn-and-work-diffn-needs
type: task
title: the mockup catches up with preview.whyn, and work.diffn needs a ruling
status: deprecated
severity: soft
always: false
summary: "Closed without being built: a later ruling makes its premise a non-issue, and its one real question was split out."
summary_of: d77f70bc0baadaef
summary_was:
  - 2026-09-05 One sentence in the design has fallen behind the app, and another needs a decision about how it shows the formatting it describes.
scope: []
tags:
  - v2
  - ui
  - strings
  - mockup
  - tree-parity
  - "plan:walk"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: 2026-09-05
checksum: 137762fe6d0ad6a9
plan: walk
seq: "16"
state: todo
priority: "2"
source: "plan:walk seq:1"
verified_on: 2026-09-05
---

# the mockup catches up with preview.whyn, and work.diffn needs a ruling

CLOSED 2026-09-05 as superseded by DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written.
Status is deprecated rather than state done: nothing here was built, the premise dissolved. The
reasoning is kept because the way this task expired is more useful than the task was.

WHY THE FIRST HALF IS NOT A DEFECT. The item labelled it itself: preview.whyn is THE APP AHEAD OF
THE DRAWING. The freeze ruling says in its own words that the product may run ahead of the mockup
without that being a fault, and that only the mockup-ahead direction is a finding. So there was
nothing to fix, and the only action this task proposed — change the mockup — is now forbidden.

AND ITS STATED BLOCKER WAS STALE WITHIN A DAY. The task says preview.whyn "cannot be reworded in
the app because strings-parity holds the key set equal to the mockup’s data-t set in BOTH
directions". That second direction was dropped on 2026-08-26 — the day after this was written. The
reason it had to be a mockup task stopped being true almost immediately, and nobody re-read it.

THE QUOTED COMPARISON NO LONGER DESCRIBES EITHER FILE. It contrasts the mockup’s "NEEDS a stable
code" with en.js’s "BINDS TO a stable code". The shipped sentence now reads "The fix maps to a
stable code on {m:injection()}" — reworded again since. A task that quotes two strings is a task
that expires when either one moves.

THE SECOND HALF IS ALREADY CORRECT IN THE PRODUCT. plan:rulings seq:49 was folded in here and said
work.diffn tells the reader the diff is word-level while lineDiff is line-level. Both string tables
now say line-level, so the screen no longer describes itself wrongly. Only the frozen drawing still
says word-level, and a frozen reference is allowed to hold an outdated sentence. seq:49’s other
half — watch-model.ts saying "the 15-minute idle exit" when IDLE_MS is eight hours — is gone from
the source and from both READMEs.

WHAT SURVIVED, and it is the only part that ever needed the owner: whether {m:<ins>} and {m:<del>}
become run markers like {b:} and {i:}. Split into OPENQ-do-the-ins-and-del-marks-become-run-markers-
or-is-a-marker, where it can be answered on its own terms rather than underneath two settled halves.

HOW THIS TASK WAS MISHANDLED, recorded because the pattern is the point. It was put to the owner as
"the mockup carries emphasis the shipped English does not — which side moves?" That is not what it
says; its first line is "Both are real and NEITHER IS AN EMPHASIS PROBLEM". He ruled on a
description that was wrong, a lane acted on the ruling, the edit was committed, and it was then
reverted for an unrelated reason — the freeze — which is the only reason anyone re-read the item.
See LESSON-a-lane-was-told-to-edit-a-file-a-standing-owner-ruling-had.

## Relations
- supersedes [[TASK-preview-whyn-still-says-the-gate-ladder-needs-a-stable-code]]
