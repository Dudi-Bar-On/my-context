---
id: TASK-the-status-counts-table-is-the-one-quantity-left-on-bare
type: task
title: the status counts table is the one quantity left on bare glass, deliberately
status: active
severity: soft
always: false
summary: One table of figures sits on the translucent background where every other set of numbers sits on a solid one; settle whether that is right.
summary_of: 533729e286f718c5
scope: []
tags:
  - "plan:repaint"
  - "seq:7b"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 9d38b5471516f735
plan: repaint
seq: 7b
state: todo
priority: "2"
---

# the status counts table is the one quantity left on bare glass, deliberately

Flagged by repaint task 7 and left for the owner's eye rather than decided alone.

Status's counts table - Items 43, Drafts 3 and the rest - is real measured quantity, currently plain --ink text with no colour-coded mark, sitting on glass rather than a plate. It was left off the eighteen because the spec's wording is 'text may float on glass; data may not', and a bare digit carries no hue that could mislead: the failure the plate prevents is the SAME tier reading as two colours on two halves of a screen, and an uncoloured number has no tier.

That is a defensible reading and it is a judgement call, recorded in the checker's own header.

Worth settling when task 9 turns that screen's .card.gloss into .card.pane, because that is the moment the numbers start sitting on real glass rather than a legacy card.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND IT IS RIPE. The moment it named has arrived and nobody came back -- the third instance of that pattern in this reconciliation.

Its own last line: "Worth settling when task 9 turns that screen s .card.gloss into .card.pane, because that is the moment the numbers start sitting on real glass rather than a legacy card." REPAINT TASK 9 IS DONE, and `src/ui/public/screens/status.js` · `el('div', 'card pane')` · ~76 builds `el('div', 'card pane')`. The numbers are on real glass now.

So the judgement call recorded here is live rather than hypothetical, and it is a LOOKING question -- the owner s eye, on the rendered screen, which the tree-parity inventory can now show him side by side. Tree parity reports status as one of the two CLEAN screens, so nothing else will ever raise it.

THE ARGUMENT FOR LEAVING IT is recorded and is defensible: the spec says "text may float on glass; data may not", the failure a plate prevents is the SAME tier reading as two colours on two halves of a screen, and an uncoloured number has no tier. The owner is being asked to confirm a reading, not to fix a defect.
