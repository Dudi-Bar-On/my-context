---
id: TASK-the-tree-walker-must-ignore-the-design-s-own-proposed
type: task
title: the tree walker must ignore the design s own PROPOSED annotation
status: active
severity: soft
always: false
summary: The comparison keeps reporting the design's own note to itself as a missing feature; teach it to skip that, and only that.
summary_of: f760e50a39a91e5a
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - gate
  - "plan:walk"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 5aa77695a360a1fb
plan: walk
seq: "4"
state: todo
priority: "2"
source: "plan:port seq:98, proc"
---

# the tree walker must ignore the design s own PROPOSED annotation

Carries out the ruling of the same date: the PROPOSED chip is the design annotating itself, not UI.

The walker reports `span.verdict` ABSENT from the app on proc, and the same on port and packs. The app is right to omit it, so the report is the thing that is wrong.

WHAT THE WORK IS: teach the walk to skip the annotation -- the `span.prop` chip and the `span.verdict` that carries only it -- and re-measure all twenty-one screens. Do NOT skip every `span.verdict`: on the preview screen the same class holds `exactly what Claude gets`, which is real UI copy, and a blanket skip would hide a genuine gap there to fix a false one here.

DO NOT EDIT THE MOCKUP INSTEAD. Deleting the annotation would make the gate green by destroying the fact that the screen is a proposal -- which is exactly the fact the PROPOSED audit, plan:walk seq:5, is about to depend on.

Record the new totals against the 182 / 97 / 14 / 71 measured 2026-08-23, so the inventory says how much of the drop was this and not code.

CORRECTION, 2026-08-25, found walking port: span.prop MEANS TWO DIFFERENT
THINGS, and a blanket skip would delete a real one.

  port, MOCKUP:  "Export / import PROPOSED" -- in div.phd, the HEADING. The
                 design annotating its own maturity. This is the one to ignore.

  port, APP:     "git bundle PROPOSED" -- inside a CARD. A fact about a
                 FEATURE: that export format is proposed. Real UI, and the app
                 draws it while the mockup does not.

So the rule is not "skip span.prop". It is: skip the chip that annotates the
SCREEN -- the one in div.phd, inside span.verdict -- and keep every chip that
annotates content inside a card.

The two are reported today as one ABSENT and one EXTRA on the same screen,
which reads as a placement bug and is not one. Getting this wrong in either
direction is bad: a blanket skip hides the app drawing a proposal chip the
design does not, and no skip keeps three false findings on proc, port and
packs.
