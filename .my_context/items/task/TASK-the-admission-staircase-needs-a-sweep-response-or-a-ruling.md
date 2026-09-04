---
id: TASK-the-admission-staircase-needs-a-sweep-response-or-a-ruling
type: task
title: the admission staircase needs a sweep response, or a ruling that N+1 is acceptable
status: superseded
severity: soft
always: false
summary: A chart showing what fits within a budget needs the whole curve fetched in one go, instead of hundreds of separate requests.
summary_of: 728daabc72ee4d2e
acknowledged:
  - body_disagrees_with_meta@b7cbf8947064700d
scope: []
tags:
  - "plan:ui1"
  - "seq:17c"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: 2026-09-03
checksum: 0b50ab1add1f90ea
plan: ui1
seq: 17c
state: done
priority: "1"
---

# the admission staircase needs a sweep response, or a ruling that N+1 is acceptable

Third of the four charts the owner ruled must be drawn.

The admission staircase (#stair) and threshold ladder (#ladder) show what is admitted as a budget sweeps. The screens agent established it IS reachable today at N+1 round trips: one /api/simulate with the tier at 0 returns the full ordered candidate list in spilled with costs, giving the rung set; then one call per rung for the real full.length.

On this corpus that is dozens to hundreds of sequential local requests per event, session or focus change. That is a request-volume and caching decision, not a detail.

Two ways: a sweep response that returns the whole curve in one call, or a ruling that N+1 is acceptable with the caching to make it bearable. The first is more work and the right shape; the second is available today.

It also dropped sim.snap and sim.stairn with the chart, on the grounds that a slider which does not snap under a sentence promising it does is worse than a missing chart. Those return with it.

ANSWERED 2026-08-24, in the simulate walkthrough of plan:port seq:98.

This task asked for a sweep response OR a ruling that N+1 is acceptable. It got
a ruling, and the ruling is neither of the two it offered:

  ONE READ-ONLY SWEEP ENDPOINT ON THE SERVER.

N+1 was declined, and not on cost. apiSimulate already calls store.all() ONCE
and select() is pure over that array, so one request is one load and N
in-memory runs. The single snapshot is what makes the curve self-consistent:
under N separate requests the corpus can change between two rungs and the
staircase becomes internally contradictory, which is wrong rather than slow and
which nothing would catch.

Re-running fitToBudget in the browser stays refused, for the reason this file
and simulate.js already give.

And the part that was never in doubt but is now recorded: THE STAIRCASE IS
BUILT. Dropping it from the design of record was offered and declined.

The implementation is plan:walk seq:7, which carries sim.stair, sim.stairn,
sim.thresh and sim.snap together -- the snapping slider is not separable from
the chart, because sim.snap promises snapping in prose.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: SUPERSEDED BY plan:walk seq:7, "build the sweep endpoint, and the staircase that has been waiting for it".

THIS TASK S OWN DELIVERABLE WAS THE RULING, and it has it -- appended above, 2026-08-24: one read-only sweep endpoint, N+1 declined because a curve assembled from N requests can be internally contradictory when the corpus changes between two rungs. That is wrong rather than slow, and nothing would catch it.

THE BUILD IS walk seq:7, priority 1. Also waiting on it: plan:screens seq:3s, which MEASURES the same absence as a set of missing element kinds, and the two dropped strings sim.snap and sim.stairn, which return with the chart.

Closed because what it asked for arrived. The staircase is still not drawn -- walk seq:7 is where that is tracked, and closing this must not be read as the graphic existing.

## Relations
- superseded_by [[TASK-build-the-sweep-endpoint-and-the-staircase-that-has-been]]
