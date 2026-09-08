---
id: TASK-the-handover-asks-on-a-widening-then-narrowing-schedule-and
type: task
title: the handover asks on a widening-then-narrowing schedule, and a subagent writes the block
status: active
severity: soft
always: false
summary: Progress notes are taken less often early on and just as often near the end, and the writing itself is handed off, so keeping the notes stops using up the room they exist to protect.
summary_of: 1cbbfedc92db33b7
scope:
  - src/core/handover-ask.ts
tags:
  - v2
  - handover
  - context
  - "plan:handover"
  - "seq:19"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 2179c80b09817b6b
plan: handover
seq: "19"
state: todo
priority: "1"
---

# the handover asks on a widening-then-narrowing schedule, and a subagent writes the block

Owner ruling 2026-09-08, on noticing the mechanism eating the runway it exists to protect: "starting
handover at 85% is to early and each handover generation is adding to the context window text that
also fills the window faster so we should try to optimize this".

THIS REVERSES PART OF HIS OWN INSTRUCTION OF 2026-09-06, which plan:handover seq:12 implements, and
the reversal is narrow: the GOAL is unchanged - as little unrecorded work as possible at the moment
the window dies - and only the schedule that serves it changes.

THE COST, MEASURED ON THIS SESSION RATHER THAN ESTIMATED. Eleven handover updates between 85% and
96%, adding 783 lines / 42 KB to reports/V2-HANDOVER.md. The written prose is about 2K tokens each,
but the update is a whole turn - read the state, compose, stage, commit, push - so call it ~3.5K
all-in. Eleven of those is ~38K tokens. The window between 85% and 100% is ~150K tokens.

  ABOUT A QUARTER OF THE REMAINING RUNWAY WAS SPENT BY THE MECHANISM THAT EXISTS TO PROTECT IT.

Fifteen steps from 85 would have spent roughly a third.

WHAT IS NOT THE PROBLEM, checked before changing anything: the INJECTION is bounded. `readHandover`
(`src/core/handover.ts` - `export function readHandover`) caps to `budgetTokens` via `capToBudget`
and delivers only the marker section or the head, so the 4,127-line file is not landing in context
whole. The cost is entirely GENERATION. A fix aimed at the file's size would have missed.

RULED - TWO CHANGES, AND THEY COMPOUND.

FIRST, THE CADENCE BECOMES GEOMETRIC RATHER THAN LINEAR, and this serves the 2026-09-06 goal BETTER
rather than trading it away. A handover written at 86% is near-worthless: it will be superseded ten
times before the window dies. The one at 99% is the only one that is ever read. A linear 1% step
spends equally on both, which is the defect. So the steps widen at the start and narrow at the end:

    90 .... 92 .... 94 .... 96 .. 97 .. 98 .. 99
      2%     2%      2%      1%    1%    1%

Asks fire on ENTERING each band: 90, 92, 94, 96, 97, 98, 99 - SEVEN, against fifteen today.

AND THE 85 ASK IS DROPPED BY MOVING THE THRESHOLD, NOT BY SUPPRESSING THE FIRST ASK. Owner ruling
2026-09-08, asked directly because the first draft of this item filed eight rather than the seven he
chose: "drop the 85 ask, keep it at 7".

The mechanism to do that is the cheaper one and it is worth naming, because the obvious
implementation is worse. Special-casing "arm at 85, do not ask until 90" would leave the threshold
meaning two different things - the point the mechanism wakes up and the point it first speaks - and
every later reader would have to hold both. Instead `handover.thresholdPercent` moves from 85 to 90.
Then the first band boundary IS the threshold, "ask on crossing the threshold" survives completely
unchanged as the behaviour that predates seq:12, and the count is seven by construction rather than
by subtraction.

So this half of the ruling REMOVES a special case rather than adding one, and the only code that
changes is `askStep`.

The tail is DENSER than today in the only region that matters: from 96 to 100 the step is 1%, which
is what it is now, so nothing is lost where the risk is real.

SECOND, THE BLOCK IS COMPOSED BY A SUBAGENT. The expensive half of a handover update is writing the
prose, not deciding what belongs in it. So the decision stays here - a short brief naming what
landed, what was ruled, and what is still owed - and a subagent turns that into the block, commits,
pushes and reports one line. That moves ~3.5K tokens per update to ~500.

This is not a new idea in this project, it is RULE-delegate-to-subagents-by-default-to-preserve-the-
context applied to the one turn that was exempt from it by habit.

AND THE ONE THING THAT MUST NOT MOVE WITH IT: a handover is worth reading because it carries a
judgement about what mattered, and a subagent handed only a file diff does not have that judgement.
The brief carries it. A lane that is told "write the handover" rather than "record THESE things"
will produce a changelog, which is the failure mode to watch for and the reason this half of the
ruling could fail.

TWO SMALLER MEASURES, ruled in the same breath and cheaper to build:
  - A STEP UPDATE IS A DELTA, capped around 25 lines: only what changed since the last block. The
    full narrative block is written once on crossing the threshold and once at the last step.
  - A STEP WITH NOTHING TO RECORD ROLLS FORWARD instead of firing. Two of this session's eleven
    updates added 11 and 14 lines because nothing much had landed. The audit log already knows
    whether a lane landed or a ruling was made since the last block.

WHAT THE IMPLEMENTATION ACTUALLY TOUCHES, so this is not read as bigger than it is: `askStep`
(`src/core/handover-ask.ts` - `export function askStep`) returns `Math.min(ASK_CEILING_PERCENT,
Math.floor(percent))` today. Geometric bands make it a band-identifier function over the same
input, and everything downstream - the latch carrying the last step asked at, the stand-down path,
the audit row naming which ask a verdict belongs to - keeps working unchanged because it only ever
compares steps for equality. The two things seq:12 said not to break are still not to be broken.

AND A STRUCTURAL NOTE THAT IS NOT PART OF THIS RULING: reports/V2-HANDOVER.md is 4,127 lines and is
prepended to forever. It is not hurting context today, because the read is budget-capped, but every
edit and every read of it gets more expensive and nothing prunes it. Rolling blocks older than the
current milestone into an archive file is worth doing later, and is deliberately NOT bundled here.

WHO CHANGES WHAT, AND IT SPLITS ACROSS THE ONE BOUNDARY THIS PROJECT DOES NOT CROSS.

`handover.thresholdPercent` is 85 in `.my_context/config.json`, and that file is the OWNER’S. The
hook says so verbatim - "changes to .my_context/config.json are the user’s to make - ask, do not
edit" - so a lane implementing this item MUST NOT move 85 to 90 itself, and neither may I. The
ruling is recorded here; the edit is his, one line, and until he makes it the geometric bands
simply start at 85 and the count is eight rather than seven.

THE CODE HALF IS A LANE’S: `askStep` in `src/core/handover-ask.ts` becomes a band function, the
delta cap and the roll-forward-on-nothing-landed are built, and the subagent composition path is
added. None of that touches config, and all of it is correct at any threshold - which is the right
split, because it means the two halves can land in either order and neither is broken by the other
being absent.

## Relations
- amends [[TASK-the-handover-is-asked-for-again-at-every-percent-not-written]]
