---
id: TASK-expanding-a-lane-is-dead-for-every-lane-but-the-newest
type: task
title: expanding a lane is dead for every lane but the newest, because steps are only what the window happened to hold
status: active
severity: soft
always: false
summary: The expand toggle is disabled on almost every lane, because a lane keeps only the steps that survived the shared feed window.
summary_of: 279345f277b27117
scope:
  - src/ui/public/screens/watch.js
  - src/ui/server.ts
  - e2e/watch-feed.spec.ts
tags:
  - v2
  - ui
  - audit
  - lanes
  - "plan:live"
  - "seq:17"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 146133f1a07ce322
plan: live
seq: "17"
state: done
priority: "1"
verified_on: 2026-09-04
---

# expanding a lane is dead for every lane but the newest, because steps are only what the window happened to hold

Reported by the owner on 2026-09-04, in plain terms: why can he not see agent-step events, and
why is there no grouping collapse on the screen. The second half of that has an answer he could
not have known, and it is the point of this item. The collapse capability EXISTS and is correct.
It is starved of data.

Three measured facts on the live corpus. The log holds 1,846 agent-step records, so they are
written. laneGroupRows disables its toggle with steps.length === 0, so a lane with no steps in
hand renders a dead control rather than a missing one. And the newest 200 records are 173
agent-step rows belonging to ONE lane, because a SubagentStop backfills a whole lane in a single
burst. That one lane takes 87 percent of the shared window and every other lane in view reports
zero steps and cannot be opened.

Raising the window from 20 to 200 earlier the same day did not address this and was never going
to. A flat window shared between record types cannot hold more than one burst, so a larger bound
only changes WHICH single lane is expandable. The next burst starves the one before it.

The shape of the fix already exists for the neighbouring case. resolveDispatch fetches a lane
dispatch that fell outside the window, on demand and by agent id, and the file documents it as a
courtesy the screen does not depend on. There is no equivalent for steps, and that asymmetry is
the defect: a lane can recover its own header from beyond the window but not its own contents.

What to build: a lane opens its steps on demand by agent id rather than hoping the shared feed
still holds them, so any lane on screen can be expanded regardless of how many bursts have
landed since. Decide and state what the toggle does before its steps arrive and if the fetch
finds none, because a control that is enabled but silent is worse than one that is honestly
disabled. A lane that genuinely recorded no steps must stay distinguishable from one whose steps
have not been fetched yet.

Consider also whether agent-step should keep competing one for one with every other record type
in the flat feed at all, given that a lane collapses to a single row on screen either way. That
is the same pressure seen from the other side and it was deliberately not attempted before
because it touches the lane grouping. It is in scope here only if it can be done without
weakening that grouping.

Verify as a user in a browser per the standing ruling, with more than one finished lane on
screen. One expandable lane is the bug, not the fix.
