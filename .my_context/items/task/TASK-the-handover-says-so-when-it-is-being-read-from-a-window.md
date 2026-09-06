---
id: TASK-the-handover-says-so-when-it-is-being-read-from-a-window
type: task
title: the handover says so when it is being read from a window that has ended
status: active
severity: soft
always: false
summary: Notes written near the end of one session say plainly, when delivered, that their running commentary is history.
summary_of: 820f1a03550ac2ad
scope:
  - src/hooks/session-start.ts
  - src/core/handover-ask.ts
tags:
  - v2
  - handover
  - "plan:handover"
  - "seq:17"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: e6f0b81cec84ecad
plan: handover
seq: "17"
state: done
priority: "2"
verified_on: 2026-09-07
---

# the handover says so when it is being read from a window that has ended

Owner ruling 2026-09-06 (plan D17). D14 made the handover CURRENT; this is what makes its staleness
impossible to miss at the one moment it matters.

CHOSEN: assert when the handover is CONSUMED - not a doctor check, and not a schedule.

WHY THAT MOMENT. SessionStart already knows both percentages when it delivers the block. That is
when staleness stops being cosmetic, because a stale handover is about to be BELIEVED. It fires
once per session, at the point of use, and costs nothing when the handover is fresh.

WHY NOT DOCTOR, and the reason is a boundary rather than a preference: doctor checks the CORPUS -
files, citations, scopes, rosters - and askedAtPercent is SESSION state in a latch that dies with
the session. A doctor check reading it would go red or green for reasons no commit caused, which is
a different kind of fact from everything else doctor knows.

WHAT IT SAYS, and the wording is the whole value: a handover written at 96% and read into a window
at 12% is not merely old, it is a report from a window that ENDED. Its "currently running" and
"waiting on" claims are historical. That is exactly the failure this project has already had - a
lane died and the handover still said it was running, twenty minutes later.

NOTHING IS BLOCKED. It fails like a linter, after the fact, and MUST NOT make the handover harder to
write - the write happens at high occupancy with no room left, which is the constraint that outranks
this feature.
