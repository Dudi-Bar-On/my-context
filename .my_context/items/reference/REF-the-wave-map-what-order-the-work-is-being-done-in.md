---
id: REF-the-wave-map-what-order-the-work-is-being-done-in
type: reference
title: "the wave map: what order the work is being done in"
status: deprecated
severity: soft
always: false
summary: The order of the work is now worked out by the tool itself; what stays here is why a group of work exists and how widely it may run.
summary_of: 9240fcfbe5afeae1
summary_was:
  - 2026-09-07 The wave map is now the execution board in reports; what stays here is why a wave exists and how wide it may run.
  - 2026-09-05 The order the work is being tackled in, grouped so that jobs which do not touch each other can be done at the same time.
acknowledged:
  - body_disagrees_with_meta@7b97dcfdbb81c28c
  - reference_no_source@7b97dcfdbb81c28c
scope: []
tags:
  - v2
  - planning
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: 2026-09-10
checksum: 46d211d5fd0d339e
---

# the wave map: what order the work is being done in

> **SUPERSEDED AS A LIST, 2026-09-05. The live board is `reports/EXECUTION-BOARD.md`.**
>
> This item held the wave map from 2026-08-28 until today. It went stale, and so did the
> board beside it, and the project ended up with two documents each claiming to be the one
> place to look. The owner ruled there should be one.
>
> **`reports/EXECUTION-BOARD.md` is that place.** It carries every open task, grouped into
> waves by what unblocks what, and a rule that a newly filed task is added to it at the moment
> it is filed. A task that lives in the corpus and not on the board is invisible to the only
> place anyone looks.
>
> **What survives here, because it is reasoning rather than a list:**
>
> A wave groups tasks that can run CONCURRENTLY because they own disjoint files. One task per
> lane at a time; up to three lanes at once. The measured reason: 58% of open UI tasks touch
> `docs/design/web-ui-mockup.html` or a string table, so those are a single serial lane, and
> parallelism beyond three has produced contention rather than speed on this repository.
>
> That measurement held again on 2026-09-05: three lanes writing to `src/ui/public/**` had to
> be sequenced behind each other for `styles.css` and the two string tables, and a fourth was
> given a hard instruction to report the strings it needed rather than add them.
>
> `DEC-the-wave-is-the-order-and-priority-is-a-tiebreak-within-it` records why the order is
> authored rather than derived, and what that costs. That decision still stands; only the list
> moved.

RETIRED AS A POINTER TOO, 2026-09-07. Owner ruling: the execution board is retired and the
handover is the single place. So this item no longer points anywhere live either.

WHERE THE TWO JOBS WENT. ORDER is now computed by the product from the corpus itself --
`mycontext ready [--plan <p>] [--held]` reads the `needs:` fields and answers what is
dispatchable, highest priority first. It cannot go stale because nobody keeps it by hand. STATE and
narrative live in `reports/V2-HANDOVER.md`.

WHY THE BOARD WAS RETIRED, and it is the same failure this item already suffered: the board was
rewritten on 2026-09-05 to be "the single place", declared in its own rules that every new task must
be added when filed and every landing logged -- and was then never touched again while forty-odd
items were filed and fifteen closed. A hand-kept order document goes stale in days. That is now
twice, which is enough evidence.

WHAT THIS ITEM IS STILL FOR, unchanged: why a wave exists and how wide it may run. That is
reasoning, not a list, and reasoning does not rot the way a roster does.
