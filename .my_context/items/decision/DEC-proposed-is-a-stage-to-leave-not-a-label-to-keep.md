---
id: DEC-proposed-is-a-stage-to-leave-not-a-label-to-keep
type: decision
title: PROPOSED is a stage to leave, not a label to keep
status: active
severity: soft
always: false
summary: Calling something proposed records where the design stopped, not a resting place; each one is to be built, once someone checks it was ever fully specified.
summary_of: 8d97a251a1cbfa71
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - "screen:proc"
  - "screen:port"
  - "screen:packs"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 91dc17e6c9e69043
---

# PROPOSED is a stage to leave, not a label to keep

OWNER RULING, 2026-08-24, taken alongside the ruling that the PROPOSED chip is an annotation rather than UI.

Three screens carry it: Procedures, Export / import, Template packs. The decision is that they are to be IMPLEMENTED. PROPOSED records where the design got to, not a resting state the project is content with.

WHAT THIS REQUIRES, and it is deliberately an audit and not an assumption: for each of the three, read the spec and the plan and answer whether the feature was ever COMPLETELY defined -- not whether code exists. Some may be fully specified and merely unbuilt; some may be half-specified, in which case the missing half is design work and not implementation work, and calling it implementation is how a project ships a guess.

WHY IT IS NOT SAFE TO SKIP THE AUDIT: the proc screen already ships a working procedure list, a step table and a command row while its own subtitle says `Decided; nothing implements it yet.` Neither the chip nor the prose is a reliable report of what exists. The audit is the only route to a true one.

The work is plan:walk seq:5.
