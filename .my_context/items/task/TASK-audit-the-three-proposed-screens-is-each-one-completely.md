---
id: TASK-audit-the-three-proposed-screens-is-each-one-completely
type: task
title: "audit the three PROPOSED screens: is each one completely defined?"
status: active
severity: soft
always: false
summary: Check whether three planned screens are actually fully described, because half-designed work handed to a builder gets finished by guesswork.
summary_of: f615637af6e0ed2f
scope: []
tags:
  - v2
  - ui
  - proposed
  - audit
  - "plan:walk"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 1b8ec34fe8778dbf
plan: walk
seq: "5"
state: done
priority: "1"
source: owner ruling 2026-08-24
---

# audit the three PROPOSED screens: is each one completely defined?

Carries out the ruling of the same date: PROPOSED is a stage to leave, not a label to keep. Procedures, Export / import and Template packs are the three the design marks.

FOR EACH ONE, ANSWER IN THIS ORDER and do not collapse the two questions:
1. Is the SPEC complete -- does the design of record say what the feature does, in every state, or does it show a screen and leave the behaviour to be inferred?
2. Is there a PLAN, and does the plan cover what the spec says?
Only then: what is built, and what is left.

WHY THE ORDER MATTERS. A half-specified feature called half-implemented gets "finished" by someone guessing the missing half. If the spec is incomplete, the missing part is DESIGN work and it comes back to the owner -- it is not implementation work and must not be scheduled as such.

DO NOT TRUST THE SCREEN S OWN PROSE. proc ships a working procedure list, a step table and a command row while its subtitle still reads `Decided; nothing implements it yet.` The chip and the copy are both stale reports.

The deliverable is one honest statement per screen, and whatever tasks it turns out to need. It is not a promise that all three ship.
