---
id: TASK-the-item-pane-draws-no-delivery-sparkline-and-the-read-model
type: task
title: the item pane draws no delivery sparkline, and the read model cannot feed one
status: active
severity: soft
always: false
summary: The detail panel is missing its twelve-week history bar, and the data behind it cannot tell a quiet week from a rejected one.
summary_of: c247a30b525f5556
scope: []
tags:
  - v2
  - ui
  - dataviz
  - "screen:preview"
  - api
  - "plan:walk"
  - "seq:40"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: a663f096b752bb0e
plan: walk
seq: "40"
state: done
priority: "1"
source: "owner request 2026-08-25: the item detail pane, app vs mockup, real corpus"
---

# the item pane draws no delivery sparkline, and the read model cannot feed one

FOUND 2026-08-25 by owner request 2026-08-25: the item detail pane, app vs mockup, real corpus. The owner asked for this specifically: "the right pane window should have same content and format as it is in the mockup including the delivered twelve weeks graph".

WHAT THE MOCKUP DRAWS, four elements the app has none of:
    `<div class="welllabel" data-t="pane.hist">Delivered - twelve weeks</div>`
    `<div class="spark plate" id="panespark">` with TWELVE `<i>` bars
    `<p class="small" id="panespn">` -- "Last delivered this week. 0 spills in that window."
    `<p class="small" data-t="pane.histn">` -- the sentence explaining the marks

THE CSS IS ALREADY WRITTEN, in the mockup and not carried: `.spark` is a flex row of 26px bars; `.spark i` is 7px wide in `--gold`; `.spark i.dead` is `--edge-3` for a week with no delivery; `.spark i.sp` is a 45-degree `--crit` hatch for a week the item was SPILLED. THE MOCKUP S OWN COMMENT IS THE REQUIREMENT: "a quiet week and a rejected week must never look alike."

IT IS A REFUSAL, NOT AN OVERSIGHT, and `app.js` · `The mockup's twelve-week sparkline is NOT drawn` · ~1043 says so in its own words: the sparkline "is NOT drawn, and that is a refusal rather than an omission -- `read-model.ts` states in its own words that `Usage` is a count and 'a count cannot carry the spilled state at all'. An empty chart would claim a history was measured."

SO THE WORK IS A READ MODEL, NOT A CHART. `/api/item/:id` must serve TWO series, and the mockup s own data shape names them: `weeks:[7,9,6,8,11,9,7,10,8,9,6,8]` -- deliveries per week, oldest first, twelve buckets -- and `spillw:[5,7]` -- the weeks the item was SPILLED. Two different facts, from the audit projection. The chart is then ten lines.

THREE THINGS THAT MUST NOT BE LOST:
  A week with no delivery and a week with a spill are DIFFERENT and get different marks. Collapsing them is the defect the refusal exists to prevent.
  A projection that is BEHIND cannot answer this honestly. Under `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` the pane must say it is unmeasured rather than draw twelve grey bars, which would assert twelve quiet weeks.
  `REQ-restore-the-graphical-views` governs it: no external libraries, no innerHTML, logical CSS only, and an EN/HE pair for every label.

IT IS ITEM 9 OF THAT REQUIREMENT -- "Per-item delivery sparkline - twelve weekly bars, in the detail pane" -- one of eighteen views the requirement asks be restored. THE REQUIREMENT HAS EXISTED SINCE 2026-08-19 AND NO TASK IMPLEMENTED THIS ONE. Worth checking how many of the other seventeen are in the same position; that check is plan:walk seq:27's territory.

DONE 2026-08-25, code 5e69257. All seven gates green: typecheck, 4,572 node tests, 136 browser tests (Chromium and real Chrome), four static gates.

BUILT THE MISSING SOURCE RATHER THAN RELAXING THE REFUSAL, which is what the task asked for. The refusal was right: `Usage` is a count, "a count cannot carry the spilled state at all", and an empty chart would have claimed a history was measured.

WHAT LANDED:
  `GET /api/item/:id/history` in `watch-model.ts` -- reads the audit projection through `readProjection`, the same read-only door every other projection read in this product uses. Answers TWO series: `weeks`, deliveries per bucket oldest-first, and `spillw`, the buckets that held a spill.
  `weekBucket()` does the arithmetic in JS against ONE explicit `now`, so a week boundary is decided in one place rather than by SQLite s clock formatting.
  `index.html` gains the four elements: the `pane.hist` label, `div.spark.plate#panespark`, `#panespn` and the `pane.histn` note.
  `drawSpark()` in `app.js` draws twelve bars with THREE marks -- gold for a week with deliveries, `.dead` grey for none, `.sp` hatched for a spill -- honouring the mockup s own rule that "a quiet week and a rejected week must never look alike". A spill wins the mark and the height still reports the deliveries.
  The `.spark` CSS family carried byte-identically from the mockup.

THE STANDARD IS ENFORCED ONE LEVEL IN, not abandoned: an ABSENT projection answers `weeks: null` and the pane SAYS the history is unmeasured rather than drawing twelve grey bars, which would assert twelve measured quiet weeks (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`). A BEHIND or damaged projection refuses, and the pane shows the endpoint s own words.

A SEPARATE ROUTE, NOT A FIELD ON `/api/item/:id`, for two reasons. `read-model.ts` cannot import `watch-model.ts` -- the dependency already runs the other way and adding the field would invert it. And a refusing projection must not take the pane down with it: the `<dl>` is served by the corpus and is always answerable, so a reader whose projection is behind still gets type, status, tier, scope, governs and file, and is told about the chart alone.

VERIFIED ON THE REAL CORPUS, not asserted: `CONST-evidence-must-cite-a-captured-record-id` draws ten grey bars and two gold (40% and 100%), with "Last delivered this week. 0 spills in that window." The audit log only reaches back to 2026-08-17, so ten empty buckets is the honest answer rather than a defect.

IT IS ITEM 9 OF `REQ-restore-the-graphical-views-the-design-sketches-already` -- the first of that requirement s eighteen views to be built since it was written on 2026-08-19. Seventeen remain and nobody has checked how many have tasks.
