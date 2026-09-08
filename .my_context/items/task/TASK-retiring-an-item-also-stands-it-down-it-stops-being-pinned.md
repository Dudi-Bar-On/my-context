---
id: TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned
type: task
title: "retiring an item also stands it down: it stops being pinned and stops claiming to be binding"
status: active
severity: soft
always: false
summary: An item that has been replaced also stops asking to be shown every time and stops describing itself as binding.
summary_of: 93ab37b60b58cdbf
scope:
  - src/core/mutate.ts
  - src/doctor/**
  - test/**
tags:
  - v2
  - governance
  - corpus
  - "plan:governance"
  - "seq:8"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: ee3f14756be6a323
plan: governance
seq: "8"
state: todo
priority: "1"
---

# retiring an item also stands it down: it stops being pinned and stops claiming to be binding

Owner ruling 2026-09-08, asked as a question and answered by measurement: when an item is superseded
or retired, is it also verified that it will not stay pinned or normative - a SECOND PROTECTION TIER?

THE ANSWER TODAY IS NO, AND THERE IS A LIVE INSTANCE.
supersedeItem (src/core/mutate.ts) writes status, relations and validUntil. It NEVER touches `always`
or `severity`. Measured over 1,009 items, 60 retired:
  - RULE-delegate-to-subagents-by-default-to-preserve-the-context is SUPERSEDED and still always:true
  - SEVEN retired items still carry severity: hard, including two OPENQs and a REQ

THE FIRST TIER HOLDS, WHICH IS WHY NOBODY NOTICED. RETIRED_STATUSES in src/core/select.ts filters
retired items out of injection before a pin can matter, so nothing is actually being delivered. This
task is not about a delivery bug.

IT IS ABOUT THE FIELDS SURVIVING AS DATA. `always: true` and `severity: hard` are read by things
other than the selector - counts, reports, the pinned-set review, and any feature written later by
somebody who reasonably assumes a pinned item is a live one. A retired item carrying them is an item
that still SPEAKS WITH AUTHORITY it no longer has, which is exactly
TASK-code-and-tests-that-speak-with-a-retired-item-s-authority one layer in: not a comment citing a
retired rule, but the retired rule itself still claiming to govern.

WHAT TO BUILD, and the shape matters more than the code:
  1. supersedeItem STANDS THE ITEM DOWN in the same act - clears `always`, and drops a normative
     severity - so the two can never diverge. One act, not two, for the same reason retirement
     already writes both relation directions itself rather than leaving one to a caller.
  2. A DOCTOR CHECK for the ones already in that state, because the fix above is prospective only and
     eight items are in it today. Reported, not gated: this is bookkeeping, and a person may have a
     reason.

RECORD WHAT WAS CLEARED RATHER THAN CLEARING IT SILENTLY. An item that was pinned mattered enough for
somebody to pin it; the retirement note should say the pin was stood down and when, so a reader who
wonders why a once-pinned rule is quiet gets an answer instead of a mystery. INV-nothing-is-dropped-
silently is the standing form of this.

AND ONE QUESTION TO ANSWER RATHER THAN ASSUME: `validated` is in RETIRED_STATUSES but means something
different from superseded or deprecated - it may be a status where a hard severity is still
meaningful. Measure whether any item uses it (today: none do) and say what you decided.
