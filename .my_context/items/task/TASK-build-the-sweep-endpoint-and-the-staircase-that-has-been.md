---
id: TASK-build-the-sweep-endpoint-and-the-staircase-that-has-been
type: task
title: build the sweep endpoint, and the staircase that has been waiting for it
status: active
severity: soft
always: false
summary: A chart showing how many notes actually reach a session at each allowance, including the surprise that raising it can deliver fewer.
summary_of: 3516dd5bca09d07e
scope: []
tags:
  - v2
  - ui
  - "screen:simulate"
  - api
  - tree-parity
  - "plan:walk"
  - "seq:7"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 8db5be2937c9abfa
plan: walk
seq: "7"
state: done
priority: "1"
source: "plan:port seq:98, simulate; supersedes plan:ui1 seq:17c"
---

# build the sweep endpoint, and the staircase that has been waiting for it

Carries out the ruling of the same date: the admission staircase is built, and its sweep runs once on the server. Supersedes the question in plan:ui1 seq:17c.

WHAT THE CHART IS FOR, so nobody builds a prettier version of the wrong thing. The x axis is the budget; the y axis is how many items are ACTUALLY injected at that budget. The mockup s own thresholds go 4,520 -> 5 items and then 5,820 -> 3 items: the budget rose and the count FELL. That is first-fit -- a bigger budget lets one expensive candidate near the front in, and it eats the room three cheap ones behind it were using. More budget, less context. No table of current values can show that; only the shape can, and it is the reason this screen exists.

THE ENDPOINT: one request, one `store.all()`, then the selector run at every cumulative candidate cost against that ONE array. Read-only. It may not build a projection in order to answer. It needs a bound on the rung count.

The response is one rung per candidate -- tens of entries, not thousands -- carrying the threshold, the admitted count, and which item was evicted where the count falls.

WHAT COMES BACK WITH IT, named in simulate.js s own refusal: `sim.stair`, `sim.stairn`, `sim.thresh` and `sim.snap`. The last one is the slider that snaps to rungs, and it is not optional -- `sim.snap` PROMISES snapping in prose, and a slider that does not snap under a sentence saying it does is worse than the missing chart. Ship them together or not at all.

DO NOT re-implement the selector in the browser to save a round trip. That is the one route the ruling closes, and the reason is in it.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS at priority 1, and THREE OTHER TASKS COME WITH IT. Whoever takes this is already in the right file for all of them.

ABSORBED INTO IT:
  plan:ui1 seq:17c -- SUPERSEDED. It asked for a sweep response OR a ruling that N+1 is acceptable, and got the ruling on 2026-08-24: ONE READ-ONLY SWEEP ENDPOINT. N+1 was declined not on cost but on consistency -- a curve assembled from N requests can be internally contradictory if the corpus changes between two rungs. It also returns sim.snap and sim.stairn, dropped with the chart.
  plan:screens seq:3s -- REFINES. It is the MEASUREMENT: exactly which element kinds must appear when the staircase lands (svg, path, line, circle, text, div.ladder.plate, div.readout, the divider rows). That is what lets somebody CHECK the build. Its readout half is plan:walk seq:6.

DISPATCH BESIDE IT -- same request family, same refusal to be reconstructed in the browser, and NO PARITY GATE CAN FIND ANY OF THEM because all three DRAW their element and simply never bind it:
  plan:ui1 seq:17b -- per-line index costs and the interleaved candidate order, for the ghost lane
  plan:screens seq:1s-a -- the seen set, or the ids filtered by it, for gate ladder rung 5

AND IT UNBLOCKS plan:walk seq:8, the owner s own idea -- anchor the simulator on the real context window. That block is REAL, not stale: a marker needs a chart to sit on.

## Relations
- supersedes [[TASK-the-admission-staircase-needs-a-sweep-response-or-a-ruling]]
