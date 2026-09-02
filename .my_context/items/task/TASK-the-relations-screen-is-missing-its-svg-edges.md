---
id: TASK-the-relations-screen-is-missing-its-svg-edges
type: task
title: the Relations screen is missing its SVG edges
status: active
severity: soft
always: false
summary: The relationships diagram draws its items and none of the lines between them.
summary_of: 7f9c86264b7a5250
scope: []
tags:
  - "plan:screens"
  - "seq:7s"
  - v2
  - ui
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 16bea00bbf6f6f20
plan: screens
seq: 7s
state: done
---

# the Relations screen is missing its SVG edges

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  b, path. The path elements are the relation edges - the graph draws its nodes and not its lines.
