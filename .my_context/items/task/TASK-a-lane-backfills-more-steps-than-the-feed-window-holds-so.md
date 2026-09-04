---
id: TASK-a-lane-backfills-more-steps-than-the-feed-window-holds-so
type: task
title: a lane backfills more steps than the feed window holds, so its steps evict their own dispatch and never group
status: active
severity: soft
always: false
summary: Every step a lane records pushes the row that names it further back, until the row that would group them is no longer in view.
summary_of: 5c9fc0aa44bde677
scope:
  - src/ui/public/screens/watch.js
  - e2e/watch-feed.spec.ts
tags:
  - v2
  - ui
  - watch
  - audit
  - "plan:live"
  - "seq:15"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: c7d7d75b4c764bd0
plan: live
seq: "15"
state: done
priority: "1"
verified_on: 2026-09-04
---

# a lane backfills more steps than the feed window holds, so its steps evict their own dispatch and never group

Measured on the live screen, 2026-09-04, minutes after lane grouping shipped. One lane recorded
95 steps. Its dispatch row sat 88 rows earlier in the log. The feed window holds 50. So all fifty
rows on screen were that one lane, each saying the dispatch was not in view, and no group formed.

The cause is structural rather than a mistake in the grouping. Steps are backfilled in a single
burst when a lane stops, while the dispatch was written when it started, so the steps arrive
together and push the row that names them out of the window they need it in. Any lane recording
more steps than the window holds is guaranteed to do this to itself, which means grouping cannot
fire for exactly the long lanes it was built for.

The orphan rendering is honest and should stay: it shows the id and says the dispatch is not in
view rather than inventing a purpose. What is wrong is that it repeats that once per step, so a
reader gets fifty identical rows where the old screen at least showed a mixture.

The cheap fix is to group orphans too. Steps sharing an agent id belong together whether or not
the row naming that agent is in the window, so ninety-five of them should collapse to one line
reading ninety-five steps with the dispatch not in view. That is the same join already written,
with the dispatch treated as a title that may be missing rather than as the thing that licenses a
group to exist.

Worth deciding while in there, and worth measuring rather than assuming: whether the window
should also grow, or whether the dispatch should be looked up beyond it so the group can carry a
real purpose instead of an id. Growing the window trades memory for a fix that a longer lane
defeats again; looking the dispatch up costs a read but survives any burst size. Neither is
obviously right and the choice should be argued from what a lane actually records.
