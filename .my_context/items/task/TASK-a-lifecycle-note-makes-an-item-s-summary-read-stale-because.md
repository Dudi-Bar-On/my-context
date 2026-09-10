---
id: TASK-a-lifecycle-note-makes-an-item-s-summary-read-stale-because
type: task
title: a lifecycle note makes an item’s summary read stale, because observations count toward the basis
status: active
severity: soft
always: false
summary: Retiring or replacing an entry used to mark its one-line description out of date even though nothing it describes had changed; the notes that record a retirement no longer count toward that check.
summary_of: 378ba92616c01931
summary_was:
  - 2026-09-10 Retiring or replacing an item leaves its one-line description marked out of date, even though nothing it describes has changed.
scope:
  - src/core/content-hash.ts
  - src/core/mutate.ts
  - test/**
tags:
  - v2
  - governance
  - corpus
  - "plan:governance"
  - "seq:10"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 8552f14dfbb616bb
plan: governance
seq: "10"
state: done
priority: "1"
---

# a lifecycle note makes an item’s summary read stale, because observations count toward the basis

OWNER RULING 2026-09-10, and it is D43. The finding came out of D38: retiring an item now writes a
STAND-DOWN NOTE saying what happened - and that note makes the item’s own summary read STALE, so
`doctor` reports `summary_stale` on an item whose only change was being correctly retired.

THE MECHANISM, read off the code rather than guessed. `SUMMARY_BASIS` in `src/core/content-hash.ts`
marks `observations` as `summarised`. The stand-down note IS an observation. So the moment
`governance/8`’s required note is written, the summary basis moves and the sentence is drawn as
stale wherever it appears.

AND IT IS OLDER THAN D38. The supersede `reason` observation has done exactly the same to every
replacement since long before that work - so this is not a defect D38 introduced, it is one D38
made visible by adding a second writer of lifecycle observations.

THE PRECEDENT IS ALREADY IN THE SAME FILE, which is why this is a repair and not a design.
`WORKFLOW_EXTRA_KEYS` excludes `state`, `progress`, `last_change`, `plan`, `seq`, `priority` and
`source` from what the basis sees INSIDE `extra`, for precisely this reason: they are bookkeeping
about the item rather than part of what it says. A lifecycle note is the same kind of thing.

WHAT TO DECIDE RATHER THAN ASSUME, and it is the only real question here: HOW a lifecycle
observation is told from a substantive one. Two shapes are available and the lane must pick with a
reason, not by taste:
  - by a marker ON the observation, written by whoever records it, so the exclusion is a property of
    the note rather than of its author; or
  - by the WRITER, since `recordVerdicts` and the stand-down path in `src/core/mutate.ts` are the
    only things that write these, so the set is closed and enumerable today.
The first survives a third writer arriving; the second cannot be wrong about the writers that exist
now. Say which and why in the body when it lands.

WHAT MUST NOT HAPPEN. Do not widen `SUMMARY_BASIS.observations` to `unsummarised` wholesale - a
substantive observation IS part of what an item says, and dropping all of them from the basis would
let a real change to an item pass without ever marking its summary stale. That is the same defect in
the other direction and it would be silent.

AND DO NOT CLEAR THE EXISTING STALE MARKS BY HAND. Two were re-affirmed on 2026-09-09 by passing the
same sentence back verbatim, which is the honest repair the doctor itself prescribes. Any item this
change un-stales should un-stale because the basis no longer counts the note, not because somebody
re-stamped it.

MEASURE BEFORE AND AFTER: how many items report `summary_stale` now, and how many after. The number
is the whole evidence that this worked, and `doctor` prints it.

BUILT AND MEASURED 2026-09-10, and the discrimination is BY CATEGORY.
`LIFECYCLE_OBSERVATION_CATEGORIES` in `src/core/content-hash.ts` names `retirement` and
`supersession`; `itemSummaryBasis` filters those notes out of the observations it hashes, the way
`WORKFLOW_EXTRA_KEYS` already filters keys out of `extra`. `SUMMARY_BASIS.observations` stays
`summarised` and the table's key order is untouched, so no basis moves except on an item that
actually carries a lifecycle note.

WHY THAT AND NOT A NEW MARKER ON THE NOTE, which is the choice the item asked to be made with a
reason. The category ALREADY IS a marker on the note: it is chosen by whoever records it, it
round-trips through `renderObservation`/`parseObservationLine`, and `mutate.ts` already argues which
of the two values is true of the act - "a `supersession` category here would assert a successor that
does not exist". What a table of NAMED values adds over a fresh marker is the direction of failure.
A new marker would be attachable to any observation by any writer, so an observation could quietly
stop being able to invalidate a summary and nothing would report it - the permissive hole
`WORKFLOW_EXTRA_KEYS`'s own docblock refuses. This table fails the other way: a third writer
inventing a third lifecycle category is not excluded until somebody names it here, and until then
its items read `stale` - wrong, but LOUD, and `doctor` prints it. The second reason is reach. The
notes already on disk carry their category, so this exclusion applies to every lifecycle note ever
written without one item file being touched to backfill a marker.

THE REPRODUCTION, because the defect was LATENT - `doctor` reported ZERO `summary_stale` on this
corpus at the time, the two live ones having been re-affirmed on 2026-09-09 by passing the same
sentence back. In a throwaway corpus, two commands: `add rule ... --summary ... --severity hard`
reads `summary_stale = 0`, and `edit <id> --status deprecated` reads `summary_stale = 1`. The same
two commands with the repair in place read 0 and 0. That A/B on identical input is the failing test.

THE MEASUREMENT ON THIS CORPUS. Before: 0 of 1077 items. With the repair and no migration: 12 -
every item carrying a `supersession` note, all of which read `current` beforehand because their
summaries were stamped AFTER the supersession, which is the mirror of the defect being fixed. So the
ruling and its migration are one act, exactly as the 2026-08-27 `title` ruling was.
`scripts/restamp-summary-basis-lifecycle.ts` re-stamps only items whose recorded basis still matches
the OLD formula - a proof the content is unmoved since the summary was written - and reported 0
items stale under both formulas, so nothing genuinely stale was blessed. After: 0. The committed
documentation fixture needed the same one-line migration for `DEC-search-with-postgres-full-text`,
which is why seven `test/docs` fixtures were red until it ran.

WHAT WAS PROVED BY REMOVAL. Taking the filter out of `itemSummaryBasis` reddens 4 of the 6 new tests
in `test/core/summary-lifecycle-basis.test.ts`; planting an impossible category set reddens 5 of 6.
The sixth is green either way BY DESIGN - it is the guard against fixing this in the other
direction, and asserts that a substantive observation (`limit`, `edge_case`, `evidence`, `rule`,
`note`, `history`) still moves the basis. Planting the forbidden wholesale widening -
`observations: 'unsummarised'` - reddens that guard plus the pre-existing `SUMMARY_BASIS` field-set
test in `summary.test.ts`, three tests in all. Content IDENTITY is asserted to still see the note:
the cut is inside `itemSummaryBasis` only, so `createItem`'s dedupe is untouched.
