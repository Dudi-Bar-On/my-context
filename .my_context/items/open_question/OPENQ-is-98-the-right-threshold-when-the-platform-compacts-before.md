---
id: OPENQ-is-98-the-right-threshold-when-the-platform-compacts-before
type: open_question
title: is 98 the right threshold when the platform compacts before reaching it?
status: superseded
severity: soft
always: false
summary: Is the chosen trigger point set so high it is never reached, and should it be lowered now or left until there is enough evidence to settle it?
summary_of: "2353325742772197"
scope: []
tags:
  - v2
  - owner-question
  - hooks
  - handover
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: 2026-09-08
checksum: 34415cfc3a14a99f
blocks: nothing — the default ships as 98 and the measurement will argue
---

# is 98 the right threshold when the platform compacts before reaching it?

The owner named 98 and it ships as the default. THE CONCERN, stated once: Claude Code's own automatic compaction fires BELOW 98% on current builds, so a 98% trigger can be a threshold that is never reached -- the compaction happens first and the handover is never asked for.

THE DESIGN DOES NOT ARGUE WITH THIS. It measures it. PreCompact records the occupancy it fired at, and the trigger field already distinguishes an automatic compaction from a manual one. After a handful of automatic compactions the corpus knows the number the platform actually compacts at, and the threshold stops being anybody's guess.

SO THIS QUESTION HAS A SHAPE THAT CLOSES ITSELF: leave 98 and let the measurement argue, or start lower now and adjust when the data arrives. Either is defensible; the first costs a few compactions with no handover written, the second costs a few asks that were not yet needed.

Design: docs/superpowers/specs/2026-08-27-handover-continuity-across-compaction-design.md section 4.4.

ANSWERED 2026-09-08, and the answer is neither 98 nor the 85 that replaced it.

The threshold is 90, set in `.my_context/config.json` under the owner's explicit approval, and the
ask no longer steps by a flat one percent: it widens at the start and narrows at the end, firing at
90, 92, 94, 96, 97, 98, 99. See the item titled "the handover asks on a widening-then-narrowing
schedule, and a subagent writes the block".

AND THE QUESTION'S OWN PREMISE WAS THE THING THAT MOVED. It asked whether 98 was too high to ever
be reached. The answer turned out to be about the OPPOSITE end: 85 was reached easily and reached
so early that the mechanism spent about a quarter of the remaining window describing itself. Both
the too-high and the too-low reading are answered by the same change, which is why this closes
rather than being carried.

## Relations
- superseded_by [[TASK-the-handover-asks-on-a-widening-then-narrowing-schedule-and]]
