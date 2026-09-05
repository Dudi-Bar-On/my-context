---
id: REF-the-wave-map-what-order-the-work-is-being-done-in
type: reference
title: "the wave map: what order the work is being done in"
status: active
severity: soft
always: false
summary: The wave map is now the execution board in reports; what stays here is why a wave exists and how wide it may run.
summary_of: 726cf1c6732d857b
summary_was:
  - 2026-09-05 The order the work is being tackled in, grouped so that jobs which do not touch each other can be done at the same time.
acknowledged:
  - reference_no_source@98fcf52363e700e6
scope: []
tags:
  - v2
  - planning
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: bf03640594d88eee
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
