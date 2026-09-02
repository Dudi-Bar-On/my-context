---
id: TASK-the-parity-gates-must-understand-a-screen-that-instantiates
type: task
title: the parity gates must understand a screen that instantiates a pattern
status: active
severity: soft
always: false
summary: Teach the comparison checks that a screen may reuse a shared control, so borrowed pieces stop being reported as invented.
summary_of: 2fb6d1f0ef29d136
scope: []
tags:
  - v2
  - ui
  - builder
  - gate
  - tree-parity
  - "plan:walk"
  - "seq:21"
  - "state:blocked"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 07c1fcee19a4d43e
plan: walk
seq: "21"
state: blocked
priority: "2"
source: "plan:port seq:98"
needs: walk/20
---

# the parity gates must understand a screen that instantiates a pattern

The real work behind the ruling that the mockup draws the builder once.

THE PROBLEM: `screen-parity` and the tree walker both compare a screen against ITS OWN mockup section. A screen that instantiates a pattern drawn elsewhere has controls in its markup that its section does not declare, so both gates report them as invented.

That is exactly what they report today on capture (4 labels, 2 inputs, 2 selects) and palette (12, 8, 3), and it is why those findings are noise rather than defects.

WHAT THE GATES NEED: a way for a screen s section to SAY it instantiates the builder, and for the comparison to then expect the pattern s markup there. The mockup already has a mechanism for saying things about a section -- `data-p` names it -- so this is likely one more attribute rather than a new concept.

DO NOT SOLVE IT WITH A KNOWN_GAPS ENTRY. That ledger is for gaps that will close; a screen correctly instantiating a pattern is not a gap and would sit there forever, which is how a shrink-only ledger stops meaning anything.

Blocked on seq:20: there is no pattern to reference until it is drawn.
