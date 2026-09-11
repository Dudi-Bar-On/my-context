---
id: MEAS-the-handover-measured-for-reliability-truth-and-use-and-the
type: measurement
title: the handover measured for reliability, truth and use, and the one question that is not measurable
status: active
severity: soft
always: false
summary: A check of whether the notes one work session leaves for the next are accurate, whether anyone acts on them, and what about their worth simply cannot be known.
summary_of: 4e4fd0916addd086
scope:
  - reports/V2-HANDOVER.md
  - scripts/check-handover.ts
  - reports/2026-09-11-the-handover-measured.md
tags:
  - v2
  - handover
  - measurement
  - d36
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 0c1b970684bed2cd
---

# the handover measured for reliability, truth and use, and the one question that is not measurable

The owner asked on 2026-09-11 whether the handover mechanism can be measured for
effectiveness, reliability and impact on ongoing development, and connected it to the
self-improvement mechanisms (D36). This item is that lane. The measurement itself is
reports/2026-09-11-the-handover-measured.md; what follows is what it established, so the
result is in the corpus and not only in a report.

RELIABILITY, over time rather than today. scripts/check-handover.ts was run against all 47
committed states of reports/V2-HANDOVER.md, each paired with the corpus as it stood at that
commit, by extracting both with git archive into a scratch tree. 40 of 47 states resolve every
pointer. Two episodes do not. The first, 2026-09-03, is an artefact of the corpus relocation:
DEC-focus-discloses-and-allows existed since 2026-08-16 inside the nested corpus and dangled
for fourteen hours until the nested items came home. The second, 2026-09-09, is a real false
claim: live/23 was announced as filed and never was. So zero-dangling is neither always true
nor recent.

AND THE REPAIR COMMIT UNDERSTATES ITS OWN WINDOW. 663ac8dd says the gate was red at HEAD
"since 460866a7". Measured with git rev-list, it was red for 13 commits and 1 hour 51 minutes,
from 4f61921f, and FIVE further handover blocks were written over the false pointer before
anything noticed. The gate existed since 2026-09-06 and would have answered in under two
seconds on any of those thirteen commits. That is the sharpest delivery-without-use datum this
project has: an instrument that was correct, available, documented and not run.

THE NINE CARRIED INSTRUCTIONS DO NOT FALL INTO TWO CLASSES. The checker header asks a person
to say whether each is HARD or IMPOSSIBLE. Read in full against their needs chains and against
shipped code, they fall into four, and the two extra classes are where the defects are.

TWO ARE ALREADY DONE AND THEIR ITEMS SAY TODO. builder/5 shipped in 93920f60 and builder/17 in
1be21693, both on 2026-09-07, both pinned by test/ui/builder.test.ts which passes 24 of 24. The
same two commits also landed builder/6 and builder/8. All four still carry state todo, while
builder/11 and walk/20, landed by adjacent lanes in adjacent commits, were closed. Today
mycontext ready --plan builder offers builder/17 and builder/5 as two of its three dispatchable
tasks. A lane taking that list would rebuild shipped, tested work.

ONE IS IMPOSSIBLE AS WRITTEN. walk/119 requires a missing summary to be drawn and named rather
than blank. The shipped fillPaneSummary in src/ui/public/app.js rules the opposite under its own
heading ABSENT IS ABSENT: null hides all three elements rather than drawing an empty paragraph,
a blank line or a dash. Both were read directly. A lane executing walk/119 faithfully would
reverse a ruled behaviour, and every gate would pass. It was already named in
reports/2026-09-07-walk-review.md under the walk119 anchor and put to the owner, and the item
own tail says the contradiction is unresolved. It has no needs, so mycontext ready lists it as
dispatchable; it resolves, so it is not dangling. Only the carry count sees it, and only as the
same sentence it prints for a merely large task.

ONE CAN NEVER BE CLEARED BY ANYONE. port/99 is LAST UI TASK by owner ruling, with nothing
permitted to be sequenced after it. An item designed to be last accumulates carries for the life
of the plan, so its repetition count is a fact about the schedule rather than about the work,
and the carry tier cannot tell those apart.

THE REMAINING FIVE ARE HONESTLY HARD. library/6 has all three needs done and is half landed, the
render half committed and the truth half outstanding. docsys/11 waits on library/6 alone.
budget/15 is unblocked, owner-ruled and costed and is being executed today. port/98 and port/99
share one open blocker, port/93, which is in flight. walk/141 stated hold names builder/11,
which is done, so its hold is satisfied and its text was never updated.

SO THE CARRIED TIER "still open" IS ONLY AS GOOD AS THE ITEM state FIELD, and this corpus
has four tasks whose state field has been four days stale. The handover was right about all of
them: it stopped naming builder/5 and builder/17 in the very next block after they landed.

EFFECTIVENESS, AND THE ARCHIVE LIMIT IS WORSE THAN STATED. The session archive holds ONE
substantial session, running continuously from 2026-09-02 to now, plus a 38-record stub. There
is no next session to compare a handover against, so any rate over sessions would be
manufactured and none is offered. The right unit is the compaction boundary, and those are
recorded: eight of them. Against eight crossings, 39 blocks were written inside the archived
window, and SEVEN distinct blocks of forty-four were ever the read-this-first block at an actual
crossing. That is not a verdict on the other thirty-seven, which were read 141 times and are the
record of what happened. It establishes something narrower: the percent-threshold write schedule
is not calibrated to the event the mechanism exists for.

THE ONE SIGNAL THAT DISTINGUISHES USED FROM MERELY DELIVERED, AND WHY IT DOES NOT YET
GENERALISE. The handover carry list has an OFF state and the off state has a cause: a lane
landed builder/5 and builder/17 and the next block stopped naming them, without the corpus
being updated. That is a reader behaviour recorded in a writer artefact, and it exists only
because the handover writer is also its reader. Item injection has no such loop: the pinned
set is delivered unconditionally to everyone every time, so a metric over it cannot have an OFF
state. That is D36e fifth refusal restated. The transferable shape is not counting deliveries
but noticing that a reader stops restating what an item says once it is satisfied, and that
needs two things: a record that the item was fetched, which is exactly budget/15, one of these
nine carries; and a measure of restating, which the conversation archive now supports and
scripts/check-ask-numbering.ts is the worked example of.

IMPACT ON DEVELOPMENT IS NOT HONESTLY MEASURABLE AND NO NUMBER IS OFFERED. It is a
counterfactual over a single un-replicated process with no control arm. Velocity before and
after is confounded and has no before. Work per compaction is eight points with everything else
changing. Time to first action after a crossing is measurable and uninterpretable, because the
compact summary carries the handover into the new context and the two channels cannot be
separated. Prevented defects are unfalsifiable by construction. Both directions are documented,
the handover caused live/23 to be caught and caused five blocks of propagation before that, and
netting them into a number would be manufacturing.

WHAT THIS LANE DID NOT DO. No item was edited, no gate added, no threshold set, no rule
proposed. Four corpus repairs are indicated and none was made, because closing another lane
task on a measurement say-so is the failure this project spent 2026-09-07 correcting: rule on
the walk/119 contradiction; close builder/5, builder/6, builder/8 and builder/17; update the
satisfied hold on walk/141; and apply the correction budget/15 already records against its own
scope field.

ONE FIGURE IN THE DISPATCH BRIEF DID NOT REPRODUCE, and it is the first result. The brief
described the handover as 58 dated blocks from 2026-08-21. Computed: 44 block heads, 41 dated,
earliest 2026-08-26. Every other figure in the brief reproduced exactly, because every other
figure came from scripts/check-handover.ts. The one that did not is the one no instrument
produced.
