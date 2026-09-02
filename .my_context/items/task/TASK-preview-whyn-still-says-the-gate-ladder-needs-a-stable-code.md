---
id: TASK-preview-whyn-still-says-the-gate-ladder-needs-a-stable-code
type: task
title: preview.whyn still says the gate ladder needs a stable code that now exists
status: active
severity: soft
always: false
summary: A note under a diagram says the diagram cannot be drawn yet, sitting directly beneath the finished diagram.
summary_of: eee3eb5c5d0f3a6c
scope: []
tags:
  - "plan:screens"
  - "seq:1s-f"
  - "state:todo"
  - v2
  - ui
  - docs
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: a15462551167c443
plan: screens
seq: 1s-f
state: todo
---

# preview.whyn still says the gate ladder needs a stable code that now exists

Found 2026-08-23 while building the ladder (screens plan, seq 1s). The design of record's own note under the ladder ends: Composing the fix needs a stable code on injection(); today the five causes differ only in English prose. That was true when it was written and is not true now - GateCode, GATE_RUNG and GATE_LADDER are in core/select.ts, injection() writes the code beside its sentence off the same branch, and /api/items serves it on every item. The ladder in screens/preview.js is built on exactly that field. So the screen now carries a sentence saying its own graphic cannot be composed, directly under the composed graphic. The string is transcribed key for key into both tables, so preview.whyn cannot be reworded in the app without failing strings-parity in the invented direction - the mockup has to change first, and it is the owner's file. Same for the parallel clause in the repaint plan.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: SUPERSEDED BY plan:walk seq:16, "the mockup catches up with preview.whyn, and work.diffn needs a ruling".

Same defect, same sentence, same file. walk seq:16 is later, is wider -- it carries work.diffn beside it -- and it is the one that reached the owner. This task holds the better forensic account of WHY the app cannot fix it alone (strings-parity holds the key set equal to the mockup s data-t set in BOTH directions, so rewording in the app fails in the invented direction), and that account is why walk seq:16 is written as a mockup edit rather than a string edit.

NOT DELETED. Dispatch walk seq:16; read this for the reasoning.
