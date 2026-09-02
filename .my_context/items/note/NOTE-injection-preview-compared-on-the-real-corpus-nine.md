---
id: NOTE-injection-preview-compared-on-the-real-corpus-nine
type: note
title: "injection preview compared on the REAL corpus: nine differences owned, three with no task"
status: active
severity: soft
always: false
summary: Comparing one screen against its design using real data instead of sample data turned up gaps the sample data had been hiding entirely.
summary_of: a63638339d15a89f
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - "screen:preview"
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 8048074e15c9bbb4
---

# injection preview compared on the REAL corpus: nine differences owned, three with no task

Run 2026-08-25 at the owner s request, through Playwright, at 1568x900: the app served over THE REAL CORPUS (489 items, outer repo root) beside the mockup on 58800. Every previous comparison was against `.demo-corpus`.

THE COUNT: app 248 visible nodes, mockup 209. The app draws MORE, which under `DEC-more-than-the-mockup-is-usually-right` is usually correct -- and most of the excess is data scale (18 id-kind spans against 9, 13 gov chips against 4).

NINE DIFFERENCES ALREADY HAVE AN OWNING TASK:
  the ghost lane `div.gh` 3 -> 0                 plan:ui1 seq:17b
  `span.prop`, the PROPOSED badge, 1 -> 0        plan:screens seq:1s-d
  the bare index chip `span.chip` 1 -> 0         plan:screens seq:1s-c + plan:repaint 3e
  gate ladder `div.pass.rung` 5 -> 2             plan:screens seq:1s-a (rung 5 unreachable)
  strip: no injections-today, no audit p95         plan:port seq:6
  strip: no context %, noBridge sentence overruns  plan:walk seq:29
  the `empty` zero-data toggle absent            plan:rulings seq:26
  carried items 6 against the mockup s 1           plan:screens seq:1s-e -- CONFIRMED ON THE REAL CORPUS, which is where that task said it would show and the fixture said it would not
  rail PROPOSED badges in the mockup, not the app  correct: those screens are built now

THREE HAVE NO TASK ANYWHERE. They are filed now as plan:walk seq:37, 38 and 39.

AND THE STRUCTURAL POINT, which matters more than any single one of them: EVERY ONE OF THE THREE IS INVISIBLE ON `.demo-corpus`. The screen-by-screen walk, the tree-parity inventory and all three measurements (182 -> 197 -> 164) were taken against the fixture. `plan:port seq:99`, "return the UI to the real corpus", is the task whose whole stated purpose is to find exactly this -- and it is scheduled LAST, after seq:98. One hour of looking at the real corpus found three gaps the fixture hides. That is an argument for moving a REAL-CORPUS PASS EARLIER, not for replacing the fixture: the fixture is what makes "not on screen" mean "not built".
