---
id: TASK-the-decay-screen-is-missing-its-heat-map-entirely
type: task
title: the Decay screen is missing its heat map entirely
status: active
severity: soft
always: false
summary: The screen meant to show what has gone unused has no heat map at all, which is the whole picture it exists to give.
summary_of: 942ac0a63430c49f
scope: []
tags:
  - "plan:screens"
  - "seq:2s"
  - v2
  - ui
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 81ee22b8e880d7ad
plan: screens
seq: 2s
state: done
---

# the Decay screen is missing its heat map entirely

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  b, circle, div, div.heat.plate, div.heataxis, div.hname, div.hstrip, div.legend, div.plate, i, i.badpin, i.cold, i.h1, i.h2, i.h3, i.never, i.sp, i.warm, line, rect, span.ln, svg, text. The whole SVG heat strip and its axis, legend and per-band cells.
