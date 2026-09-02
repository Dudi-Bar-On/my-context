---
id: RULE-look-at-the-mockup-and-the-plans-before-implementing-then
type: rule
title: Look at the mockup and the plans before implementing, then implement the same
status: active
severity: hard
always: false
summary: Read the design and the written plan before building a screen, build the same thing, and file a task for anything left out so nobody loses track of it.
summary_of: 686bcc58134f8f76
scope: []
tags:
  - v2
  - ui
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 334a4edf0dfac9e1
---

# Look at the mockup and the plans before implementing, then implement the same

Owner ruling, 2026-08-22, in the owner's own words: always look at the mockup and then implement the same; and if there are plans look at them too before doing.

This is a READING ORDER, and it is not optional. Before writing a line of a screen, open two things: the mockup section that screen corresponds to, and the plan and spec that own its behaviour. Implementing from memory, from a neighbouring screen, or from what seems reasonable is what produces a screen that renders and is still wrong.

THE DIVISION OF AUTHORITY

The mockup is the source of truth for DESIGN - layout, graphics, structure, classes, what appears on screen and where. See [[RULE-take-the-mockup-s-design-never-its-behaviour-behaviour-comes]].

The plans and specs are the source of truth for BEHAVIOUR - what it does, what it must never do, its empty and error states, its invariants. docs/superpowers/plans/ and docs/superpowers/specs/.

Where the two disagree, that is a finding to report, never a conflict to resolve quietly.

NOTHING IS SILENTLY OMITTED

Owner ruling in the same breath: if there are tasks that would be executed later for this mission it is ok, but if not it should be implemented right now or by adding tasks to the list. So a screen that ships without part of its mockup is only acceptable when that part is a task item somebody can see. An unbuilt thing with no task is a thing nobody will ever build.

WHY THIS WAS RECORDED

The Audit stream screen was built and landed, and looked plausible. Measured against the mockup element by element it was missing 109 SVG rects - the entire graphics of the screen - plus the token bar, the regime-change row and five status chips. The screen rendered, every gate was green, and the owner could see immediately that it was wrong. Nothing in the process caught it, because nothing had compared it to the mockup.

The instrument that found it in one pass renders both pages at the same viewport and tallies every element by tag and class. That comparison is cheap and it is the difference between a screen that runs and a screen that is what was designed.
