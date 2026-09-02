---
id: TASK-pixel-parity-render-app-and-mockup-at-one-viewport-and-diff
type: task
title: "PIXEL parity: render app and mockup at one viewport and diff them"
status: active
severity: soft
always: false
summary: Compare pictures of the real app against the design to catch spacing, colour and size differences that structural checks cannot see.
summary_of: 19f8a182266dbbdd
scope: []
tags:
  - "plan:port"
  - "seq:93"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: f292e7864be9b2c7
plan: port
seq: "93"
state: todo
needs: port/94
---

# PIXEL parity: render app and mockup at one viewport and diff them

The third rung, and the only version of "1:1" that cannot be argued with.

Tree parity catches structure; it says nothing about spacing, colour, weight or size. `styles-parity` carries CSS byte-identically, but only for the selectors it is handed - and the item detail pane proved what that misses: `plan:repaint seq:9c` rescoped the whole `#pane` block after a collision, real work on the mockup, for an element the app did not have. Six rules, unmeasured, because there was nothing to measure them against.

DO: screenshot each screen in the app and the corresponding mockup section at one fixed viewport, and diff. Playwright already provides the comparison; what it needs is seq 94's fixture, or the diff is data noise.

EXPECT TO RULE ON A TOLERANCE, and rule on it deliberately: font rasterisation differs between a headless run and a real browser, and this suite runs BOTH Chromium and real Chrome. A tolerance chosen to make a run green is a gate that measures nothing.

DEPENDS ON seq 94.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and its dependency is REAL rather than stale -- unlike three other blockers this reconciliation has cleared.

DEPENDS ON seq:94, which is still open. Without the fixture mirroring the mockup s scene, a pixel diff is data noise: this corpus draws 200 ask rows against the mockup s 2, 50 audit rows against 7, 26 coverage buttons against 7. Nothing about those diffs is a defect and all of them are red pixels.

THE TOLERANCE WARNING IN THIS TASK IS THE IMPORTANT PART and it should survive into whoever builds it: this suite runs BOTH Chromium and real Chrome, font rasterisation differs between them, and a tolerance chosen to make a run green is a gate that measures nothing. That is the same failure this project has now recorded five times in different clothes -- a gate measuring what it was pointed at.

SEQUENCE: 94, then 93.
