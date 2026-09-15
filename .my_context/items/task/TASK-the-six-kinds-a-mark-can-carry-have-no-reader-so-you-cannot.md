---
id: TASK-the-six-kinds-a-mark-can-carry-have-no-reader-so-you-cannot
type: task
title: the six kinds a mark can carry have no reader, so you cannot step to the next defect or the next question
status: active
severity: soft
always: false
summary: You can now say what kind of thing you bookmarked, but nothing lets you walk to the next one of that kind.
summary_of: b24371d8527d3263
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
  - e2e/**
tags:
  - v2
  - ui
  - recall
  - "plan:anchors"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 7d22e7a3c5ada0ac
plan: anchors
seq: "6"
state: todo
priority: "2"
---

# the six kinds a mark can carry have no reader, so you cannot step to the next defect or the next question

OWNER RULING 2026-09-15, choosing this from four the navigation lane offered rather than shipped.

WHAT EXISTS. `anchors/2` gave him six kinds — note, decision, question, defect, evidence, todo —
and `anchors/3` gave him Previous/Next mark over every stop in the document. The two do not meet:
every mark is the same to the stepper, so a reader who marked four defects across a long session
must walk every mark to find them.

WHY IT IS THE STRONGEST OF THE FOUR OFFERED: the vocabulary he just gained HAS NO READER. A kind
that nothing can be filtered or navigated by is a label, not a category — it costs him a decision
at mark time and returns nothing.

AND IT IS CHEAP, WHICH IS THE OTHER HALF OF WHY IT WAS CHOSEN. The lane that built the stepper
reported that stops are already grouped: this is a FILTER OVER `stops`, not new machinery. It
must reuse that walk rather than grow a second one — two walks that can disagree about where the
reader is would be worse than no filter.

WHAT IT MUST KEEP, because the stepper earned these and they are not to be re-litigated:
  — A STOP IS A NODE, NOT AN ANCHOR. Two marks can share one folded run; counting anchors says
    "3 of 12" and stops twelve times in eleven places.
  — THE CARET NEVER MOVES. A step destroys nothing, so it hands focus back to nothing.
  — ENDS ARE SAID, NEVER DISABLED — a disabled button cannot hold focus.
  — THE COUNT MUST SAY WHAT IT COUNTS. "3 of 24" when filtered to defects is a lie unless the
    sentence says defects. A number whose meaning silently changed is the defect `confirm/3` was
    about.
  — IT MUST WORK ACROSS THE PAGE BOUND, as the unfiltered walk does.

AND IT MUST NOT BECOME SIX CONTROLS. Six kinds times two directions is twelve buttons on a bar
measured at 26px and one line. Whatever shape is chosen — a select beside the existing pair, a
cycling filter, something else — the lane measures the bar afterwards and reports its height, the
way the stepper did.
