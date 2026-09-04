---
id: TASK-the-scope-coverage-tree-rows-are-missing-their-magnitude-bar
type: task
title: the Scope coverage tree rows are missing their magnitude bar
status: active
severity: soft
always: false
summary: The coverage rows say which areas are covered but not how much, because the small bar that would show it is never drawn.
summary_of: cf1902562737bd77
scope: []
tags:
  - "plan:screens"
  - "seq:5s"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 0e96bad07c1e7aa9
plan: screens
seq: 5s
state: done
---

# the Scope coverage tree rows are missing their magnitude bar

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  div, div.mini, i, i.g, i.u, i.x. The i.g / i.u / i.x segments are the governed / ungoverned / not-examined magnitude the mockup says each row owes: four categorical dots said WHICH rows were dark, they could not say HOW dark.
