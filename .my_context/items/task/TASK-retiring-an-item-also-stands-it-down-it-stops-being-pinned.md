---
id: TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned
type: task
title: "retiring an item also stands it down: it stops being pinned and stops claiming to be binding"
status: active
severity: soft
always: false
summary: An item that has been replaced also stops asking to be shown every time and stops describing itself as binding.
summary_of: 232a2f5eec3a0ed4
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 697c51ba8e232337
plan: governance
seq: "8"
state: done
priority: "1"
verified_on: 2026-09-10
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

BUILT, in two passes. 2026-09-08: `supersedeItem` stands the item down in the same act - clears
`always`, drops a `hard` severity, and records what it cleared as an observation rather than
clearing it silently; the predicate `standDownFields` lives once, beside `RETIRED_STATUSES`, so the
write and the doctor check ask the identical question; `retired_still_binding` (warn, never gated)
reports the ones already on disk; and the seven his ruling named were cleared the same day - eight
fields across seven items, `RULE-delegate-to-subagents-by-default-to-preserve-the-context` carrying
both. Re-measured 2026-09-10: 1,076 items, 64 retired, ZERO still pinned and ZERO still hard, and
`doctor` reports no `retired_still_binding` finding at all.

2026-09-10, AND THIS IS THE HALF THE FIRST PASS LEFT OPEN: `supersedeItem` IS NOT THE ONLY WAY TO
RETIRE SOMETHING. Four supported commands retire through `updateItem` and never touch
`supersedeItem` - `mycontext edit <id> --status deprecated`, `mycontext review discard`, `mycontext
procedure done`, and the origin half of `mycontext inbox promote`. Measured on a sandbox before the
fix: a pinned rule with `severity: hard`, deprecated through `updateItem`, came out `deprecated`
with `always: true` and `severity: "hard"` intact - which is precisely the state
`retired_still_binding` reports, so the product was still manufacturing its own findings after the
seven were cleared, and the backlog could re-form through any of those four commands.

`updateItem` now stands an item down when a status write CROSSES into `STOOD_DOWN_STATUSES`, for
the reason the line above it already gives about `validUntil`: whichever path reaches "retired",
the lifecycle fields move with it, or a direct `update_item({status: "deprecated"})` is a second,
divergent way to be retired. Only on the crossing, never on a later write to an item already
retired - that is `supersedeItem`'s own prospective ruling, and repairing a field inside an
unrelated write would be a corpus edit nobody asked for. `validated` is outside the set and so is
not a crossing. The note is categorised `retirement`, not `supersession`, because nothing replaced
the item and a supersession category would assert a successor that does not exist. `mycontext edit`
now previews the stand-down in the same two rows and the same words `mycontext supersede` uses, so
a person learns their pin is being cleared BEFORE they answer.

The `validated` question this item asked was answered by measurement and is recorded on
`STOOD_DOWN_STATUSES` (select.ts): EXCLUDED. Zero items carry it, and it means a human AFFIRMED the
item - on an affirmed item `hard` and a pin are a claim a person made, not bookkeeping debt.

ONE THING FOUND AND NOT FIXED HERE, because it is outside this item's scope and is a decision about
the summary basis rather than about retirement: `observations` is `summarised` in `SUMMARY_BASIS`
(core/content-hash.ts), so the stand-down note this item requires makes the retired item's summary
read STALE, and `doctor` reports `summary_stale` on it. The supersede `reason` observation has done
the same to the replacement since long before this work. Recording an act on the item is what
`INV-nothing-is-dropped-silently` asks for, and the summary did not stop describing the item -
either lifecycle observations are excluded from the basis the way `WORKFLOW_EXTRA_KEYS` excludes
tracking keys inside `extra`, or the staleness is accepted and said out loud. It needs a ruling and
its own item.
