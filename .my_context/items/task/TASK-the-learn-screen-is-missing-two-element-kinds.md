---
id: TASK-the-learn-screen-is-missing-two-element-kinds
type: task
title: the Learn screen is missing two element kinds
status: active
severity: soft
always: false
summary: Two small pieces of the Learn screen are still not drawn.
summary_of: abc0fc87a57e401e
scope: []
tags:
  - "plan:screens"
  - "seq:8s"
  - v2
  - ui
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 9415aff4a0836ee2
plan: screens
seq: 8s
state: done
---

# the Learn screen is missing two element kinds

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  i, span.m.
