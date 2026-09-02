---
id: NOTE-the-fixture-starved-three-views-and-fixing-it-closed-two
type: note
title: the fixture starved three views, and fixing it closed two KNOWN_GAPS entries by itself
status: active
severity: soft
always: false
summary: Two complaints about how a screen looked turned out to be poor sample data rather than broken code, and fixing the data closed two open gaps.
summary_of: 4e3eb8a4fb6b1bb2
scope: []
tags:
  - v2
  - ui
  - fixture
  - tree-parity
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: ae24fec91f329562
---

# the fixture starved three views, and fixing it closed two KNOWN_GAPS entries by itself

Done 2026-08-25 at the owner s request, code 18d4477. He asked for two things and both were the FIXTURE rather than the screens.

=== 1. THE TWELVE-WEEK GRAPH WAS EMPTY ===

The clock rewrite in `scripts/demo-corpus.ts` spread records at `(i - 180) * 47 minutes`, reaching back about six days. Measured: all thirty injection records landed in ONE week. So the item pane s sparkline drew eleven grey bars and one gold, and decay s NINETY-day heatstrip had six days of cells in a ninety-day field. Both drew correctly. Both looked broken.

A LONGER LINEAR SPREAD WOULD NOT HAVE FIXED IT, which is the part worth keeping: the injection records are CONTIGUOUS in the log -- the script writes twenty-four sessions in a loop, and all thirty sat at indices 311-340 -- so any spread preserving log order puts every delivery the corpus has ever made inside one or two adjacent weeks. The stripe had to be by SESSION. Session 0 now lands eleven weeks back and the newest just behind the pulse window. Per item: `[1,2,2,2,2,2,3,1,3,2,1,8]` -- every bucket filled, which is the mockup s own shape.

=== 2. THE DELIVERED TEXT WAS A WALL OF FILLER ===

The owner s words: "a very long text and not formated as in the mockup". Measured: the app drew seven blocks averaging 1,400 characters against the mockup s four averaging 170, and `.lit` scrolled 3,882px against 541.

TWO SEPARATE CAUSES, and only the second was a code defect.

THE FIXTURE: every pinned item s body was three paragraphs of "This text exists to occupy a measurable number of tokens". The items already carried the mockup s own TITLES; only the bodies were filler. They now carry real short bodies, and deliberately exercise the shapes the mockup s samples exercise -- bold, code spans, a bulleted list, plain prose. Budgets went to a tenth so the ghost lane still spills: LENGTH was doing the spilling, and a spill should be a property of the budget.

THE CODE: `preview.js`'s `bodyNodes()` rendered `<p>` and `<ul>` and NOTHING INLINE, so `**20**` reached the screen with its asterisks showing. The mockup s `.blkbody` is authored markup and carries `<b>20</b>` and `<span class="m">pgbouncer</span>`. It now delegates to `markdownNodes` -- the mockup s own renderer, already used by the detail pane -- rather than keeping a second, smaller spelling of the same subset.

=== WHAT THE FIXTURE CHANGE CLOSED BY ITSELF ===

TWO KNOWN_GAPS ENTRIES CAME OUT OF THE LEDGER, and neither was closed by code. Both had been listed for over a week and both were BUILT the whole time:
  `div.gh`, the ghost lane -- needed a SPILL, and the smaller budgets produce one
  `div.carrieditem.small`, the carried item block -- needed a session-start with a resolved root, and the session stripe keeps the newest NUMBERED session newest

That is the fifth and sixth time this project has read a fixture gap as a code gap. `plan:port seq:94` is the task for the whole class and this is a down payment on it, not a replacement.

=== ONE REGRESSION I CAUSED AND CAUGHT ===

The first stripe left an unnumbered tool-event session as the newest record, so the preview computed against a session whose seen file still held everything and delivered ONE item instead of six. The preview RE-COMPUTES rather than replays, so "most recent session" is load-bearing. Fixed by pinning the newest numbered session to `NOW` and offsetting the pulse walk thirty seconds behind it. Recorded in the script.

=== AND ONE RACE THE CHANGE EXPOSED ===

`e2e/item-pane.spec.ts` "an id on a different screen opens the pane too" counted `button.linkid` the moment a section ATTACHED, before `route()` had awaited its dynamic import and fetch. It walked past `doctor` (1 linkid) and `coverage` (3) and reported that no screen renders one. The race was always there; a fixture change moved the timing enough to lose it, which is the only kind of luck a time-dependent assertion ever has. It now waits for the element rather than for the container.
