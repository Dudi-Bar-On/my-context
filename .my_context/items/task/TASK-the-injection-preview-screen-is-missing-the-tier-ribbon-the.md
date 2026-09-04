---
id: TASK-the-injection-preview-screen-is-missing-the-tier-ribbon-the
type: task
title: the Injection preview screen is missing the tier ribbon, the admission ladder and the ghosts
status: active
severity: soft
always: false
summary: The main screen is missing its bar of proportions, its admission diagram and its faded rows for what did not make it.
summary_of: 584393b6edff3f43
scope: []
tags:
  - "plan:screens"
  - "seq:1s"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 34121b8c481692f5
plan: screens
seq: 1s
state: done
---

# the Injection preview screen is missing the tier ribbon, the admission ladder and the ghosts

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  button, div.binds.rung, div.carrieditem.small, div.gap, div.gh, div.ghosts, div.gladder.plate, div.head.seg, div.hint, div.index.seg, div.notrun, div.pass.rung, div.pinned.seg, div.plate, div.ribbon, div.rlabel, div.segbar, div.track, i, li, span.chip, span.chip.ok, span.n, span.prop, span.q, ul. That is 26 kinds - the tier ribbon and the admission staircase, both named as outstanding charts in the repaint plan, plus the carried-item block and the ghost rows.
