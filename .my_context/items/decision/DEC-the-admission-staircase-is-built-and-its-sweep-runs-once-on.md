---
id: DEC-the-admission-staircase-is-built-and-its-sweep-runs-once-on
type: decision
title: the admission staircase is built, and its sweep runs once on the server
status: active
severity: soft
always: false
summary: The chart showing what fits at each size limit is being built, and the whole curve is worked out in one pass so it cannot contradict itself part way through.
summary_of: 494a0610ba9f99be
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - "screen:simulate"
  - api
  - tree-parity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 710a35ffd9bb7b99
---

# the admission staircase is built, and its sweep runs once on the server

OWNER RULING, 2026-08-24, taken in the simulate walkthrough of plan:port seq:98. It answers the question plan:ui1 seq:17c has held open since 2026-08-22.

FIRST AND PLAINLY: THE STAIRCASE IS BUILT. The admission staircase, the threshold ladder and the snapping slider are part of the product. This ruling settles HOW and never WHETHER. Deleting the chart from the design of record was offered as an option and was declined; it is not to be raised again.

THE ROUTE: one read-only sweep endpoint on the server. The browser asks once; the server runs the real selector at every cumulative candidate cost and returns the whole staircase.

WHY, AND THE STRONGEST REASON IS THE OWNER S. `apiSimulate` already calls `store.all()` ONCE and then `select()` is a pure function over that array, so a sweep is one load and N in-memory runs. That one snapshot is not merely cheaper -- it is what makes the curve SELF-CONSISTENT. Under N separate requests the corpus can change between rung 3 and rung 4 (an agent captures an item mid-drag) and the staircase becomes internally contradictory: not slow, WRONG, in a way nothing would catch.

WHAT WAS WEIGHED AGAINST IT:
- N+1 round trips against the existing `/api/simulate`: no new route, but N+1 full corpus loads and a caching design that was never settled -- and it is the option that loses the consistency guarantee above.
- Re-running `fitToBudget` in the browser: fastest to build, and a SECOND implementation of the rule that decides what Claude actually gets. simulate.js already refuses it. The day the two drift the chart lies with confidence.

EXACT, NOT SAMPLED. An approximation was offered -- sweep a copy and accept that a short window of drift is "accurate enough" -- and declined, because the in-memory snapshot gives exactness for free and the mockup s own prose says `The sweep is exact, not sampled`. Trading the property away would cost the sentence with it.

CONSTRAINTS ON THE ENDPOINT: read-only, and it may not build a projection to answer -- the audit lesson, a read surface may not write. It needs a bound on the rung count rather than an unbounded sweep. The work is plan:walk seq:7.
