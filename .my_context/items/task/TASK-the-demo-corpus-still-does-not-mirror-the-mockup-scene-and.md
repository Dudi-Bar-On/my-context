---
id: TASK-the-demo-corpus-still-does-not-mirror-the-mockup-scene-and
type: task
title: the demo corpus still does not mirror the mockup scene, and now it is close enough to finish
status: active
severity: soft
always: false
summary: Keep filling out the sample data until every screen can draw what the design shows, so a missing element means missing code.
summary_of: 2f3db9fbe129203d
scope: []
tags:
  - v2
  - ui
  - fixture
  - tree-parity
  - "plan:walk"
  - "seq:44"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 8c1182bb8fea60e8
plan: walk
seq: "44"
state: done
priority: "1"
source: "owner request 2026-08-25: fill the twelve-week graph, and format the delivered text"
---

# the demo corpus still does not mirror the mockup scene, and now it is close enough to finish

FILED 2026-08-25 after the owner-requested fixture work (code 18d4477), which closed part of `plan:port seq:94` and made the remainder measurable.

WHAT IS NOW TRUE: the delivered pane draws four blocks of real short prose against the mockup s four, `.lit` scrolls 552px against 541, the twelve-week sparkline is full in every bucket, and the ghost lane and carried item block both draw -- so `div.gh` and `div.carrieditem.small` left KNOWN_GAPS.

WHAT IS STILL NOT: `preview` keeps five ledger entries -- `i`, `li`, `span.chip`, `span.prop`, `ul` -- and the other twenty screens keep theirs. Each is either a code gap or a fixture gap and THE LEDGER CANNOT TELL THEM APART. That is the whole argument of seq:94 and it is unchanged.

THE METHOD THAT WORKED, and it should be repeated screen by screen rather than generalised: take one screen, read the mockup section s own sample data, and ask what the fixture would have to hold for the app to draw the same SHAPE. Twice out of two, the answer was a fixture property nobody had connected to the missing element -- a budget too large to spill, and a session whose event type the read model would not resolve.

DO NOT TUNE THE LEDGER TO GO GREEN. Every entry removed must be removed because the element now draws, and the gate already enforces that in the direction that matters: a listed gap that has closed FAILS the suite. It caught both of these.

AND CHECK `DATA_DEPENDENT` LAST. It makes parity a CEILING for eight screens, so drawing FEWER kinds than the mockup passes silently. It can only be emptied once the fixture mirrors the scene, and emptying it is how the ceiling becomes an equality -- which is what `plan:port seq:99` assumes when it says the comparison then measures the code.

MEASURED IN FULL 2026-08-26 -- see `NOTE-the-parity-ledger-measured-78-missing-kinds-and-preview-s` and `NOTE-the-injected-blank-landing-is-a-real-trade-and-the-demo`.

TWO RESULTS CHANGE WHAT THIS TASK IS.

FIRST, PREVIEW IS DONE AND ITS THREE ENTRIES ARE NOT FIXTURE GAPS: two are accepted divergences and one is the missing emphasis marker in the string grammar. No fixture change can close any of them, so the screen that motivated this task is not waiting on it.

SECOND, THE FIXTURE S REAL LIMIT IS ITS POOL SIZE, not any single property nobody had connected. Nine normative items against a delivery of six means Injected now and the preview compete for the same items, measured as a straight trade: keeping the newest seen file gives Injected 5 rows and costs the delivered pane half its blocks. Growing the pool is the one change that serves both, and it also makes the new display bounds demonstrable instead of always reading "Showing all N".

THE REMAINING 78 ARE MEASURED AND LISTED per screen in the first note. Six screens already match completely, which the ledger never said out loud.
