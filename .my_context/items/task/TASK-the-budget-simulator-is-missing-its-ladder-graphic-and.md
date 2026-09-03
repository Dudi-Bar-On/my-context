---
id: TASK-the-budget-simulator-is-missing-its-ladder-graphic-and
type: task
title: the Budget simulator is missing its ladder graphic and divider rows
status: active
severity: soft
always: false
summary: The budget screen is missing its main diagram and its readout rows, so the thing it exists to show is not actually on it.
summary_of: 2158a216164ea52f
scope: []
tags:
  - "plan:screens"
  - "seq:3s"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: d935f97f76516dcb
plan: screens
seq: 3s
state: done
needs: walk/7, walk/6
---

# the Budget simulator is missing its ladder graphic and divider rows

Measured 2026-08-22 at 1568x779 against this repository's own corpus by e2e/screen-parity.spec.ts, which compares every KIND of element the mockup section draws against what the app draws. Read the mockup section for this screen and the plan that owns its behaviour before implementing - RULE-look-at-the-mockup-and-the-plans-before-implementing-then. When these land, delete the screen's entry from KNOWN_GAPS in that spec; the gate FAILS if a listed gap is no longer missing, so the ledger can only shrink. Missing kinds:  b, circle, div, div.at, div.card.pane.sim, div.div-l, div.div-r, div.div-row, div.ev, div.ladder.plate, div.readout, div.small, h3, i, line, path, span.div-n, span.div-name, svg, text. The SVG ladder and the divider readout.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: REFINES plan:walk seq:7 and plan:walk seq:6. Do not dispatch it separately.

THREE TASKS DESCRIBE ONE GRAPHIC from three angles, and this is the one that only names the symptom:
  plan:ui1  seq:17c  THE BLOCKER -- the admission staircase needs a sweep response, or a ruling that N+1 is acceptable
  plan:screens seq:3s  THIS TASK, THE SYMPTOM -- measured absence of svg, path, line, circle, text, div.ladder.plate, div.readout and the divider rows
  plan:walk seq:7  THE BUILD -- build the sweep endpoint, and the staircase that has been waiting for it

walk seq:7 is the implementing task and is priority 1. This task keeps its value as the MEASUREMENT -- it names exactly which kinds must appear when the staircase lands, which is what lets somebody check the build rather than admire it. It closes when walk seq:7 closes and the `simulate` entry in KNOWN_GAPS shrinks by those kinds.

THE READOUT HALF IS walk seq:6 -- the divider readout needs a data-t in the mockup first, ruled by the owner 2026-08-25 ("give the mockup a data-t and ship it").
