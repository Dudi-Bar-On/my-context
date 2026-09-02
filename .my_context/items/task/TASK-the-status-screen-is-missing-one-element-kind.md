---
id: TASK-the-status-screen-is-missing-one-element-kind
type: task
title: the Status screen is missing one element kind
status: active
severity: soft
always: false
summary: One small piece of formatting was missing from the status screen, and the check that watches for it now passes.
summary_of: 2c01803b83e54807
scope: []
tags:
  - "plan:screens"
  - "seq:9s"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 799dc9779d145cdb
state: done
plan: screens
seq: 9s
---

# the Status screen is missing one element kind

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  b.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: DONE. Closed by 61d0090, "the string grammar can say bold and italic, and eighteen screens say it".

THE EVIDENCE IS THE GATE ITSELF, not a claim. The one missing kind was `b`. `status` no longer has an entry in KNOWN_GAPS in e2e/screen-parity.spec.ts, and that file FAILS a screen whose listed gap is no longer missing -- so an entry can only be deleted by the gap closing. The suite is green at 61d0090. Tree-parity independently reports status as one of the two CLEAN screens, 0 divergences.

WHY IT WAS OPEN SO LONG: nothing connected "the string table has no bold run" to eighteen separate per-screen gap entries. One missing pair of markers was 41 findings across 18 of 21 screens.
