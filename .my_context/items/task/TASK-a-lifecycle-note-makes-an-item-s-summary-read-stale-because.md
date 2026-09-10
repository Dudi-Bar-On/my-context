---
id: TASK-a-lifecycle-note-makes-an-item-s-summary-read-stale-because
type: task
title: a lifecycle note makes an item’s summary read stale, because observations count toward the basis
status: active
severity: soft
always: false
summary: Retiring or replacing an item leaves its one-line description marked out of date, even though nothing it describes has changed.
summary_of: 35b37d0a1fa65987
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
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 62cf304b3268b6cc
plan: governance
seq: "10"
state: todo
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
