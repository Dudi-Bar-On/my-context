---
id: DEC-the-proposed-chip-is-the-design-annotating-itself-not-ui
type: decision
title: the PROPOSED chip is the design annotating itself, not UI
status: active
severity: soft
always: false
summary: A label marking part of a design as only a proposal is a note to whoever reads the design; the finished product should never show it to the people using it.
summary_of: 5edb2e3cfad3d247
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - tree-parity
  - "screen:proc"
  - "screen:port"
  - "screen:packs"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: c96f3e3726c5697a
---

# the PROPOSED chip is the design annotating itself, not UI

OWNER RULING, 2026-08-24, taken in the proc walkthrough of plan:port seq:98.

The mockup draws `span.verdict > span.prop` reading PROPOSED beside the Procedures heading, and marks Procedures, Export / import and Template packs the same way in the rail. The app draws none of them. THE APP IS RIGHT.

THE REASON: the chip marks which SCREENS are proposals in the design of record. It is not a fact about any procedure, any record or any workspace -- it is the specification talking about its own maturity. A shipped app has no reason to tell the person using it that one of its screens is a proposal.

WHAT WAS WEIGHED AGAINST IT, so nobody re-argues this from 1:1 alone: the standing rule is that the mockup is the UI specification and the app matches it. This is a declared EXCEPTION to that rule and the only one taken on this screen -- the annotation is not UI, so matching it would mean building something the design never asked for.

THE CONSEQUENCE: tree-parity finding proc #04 (ABSENT span.verdict) is retired, and so are its counterparts on port and packs. The WALKER is what changes -- it must learn to ignore the annotation -- and NOT the mockup, because the annotation is load-bearing for a reader of the design and deleting it to make a gate green would destroy the very fact that decided this ruling.
