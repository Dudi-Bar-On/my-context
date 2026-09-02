---
id: TASK-the-doctor-screen-is-missing-four-element-kinds
type: task
title: the Doctor screen is missing four element kinds
status: active
severity: soft
always: false
summary: A few small pieces of the health screen are still not drawn.
summary_of: 624b2638ad20a68b
scope: []
tags:
  - "plan:screens"
  - "seq:6s"
  - v2
  - ui
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 238ddaf8f5726b27
plan: screens
seq: 6s
state: done
---

# the Doctor screen is missing four element kinds

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  b, span.m, span.m.v, span.prop.
