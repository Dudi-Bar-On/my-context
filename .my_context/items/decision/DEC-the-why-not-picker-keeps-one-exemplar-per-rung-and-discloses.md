---
id: DEC-the-why-not-picker-keeps-one-exemplar-per-rung-and-discloses
type: decision
title: the why-not picker keeps one exemplar per rung and discloses it, rather than offering every failing item
status: active
severity: soft
always: false
summary: A small explainer shows one fixed example of what fails each test and says so plainly; the things that really got left out are named in a proper list below.
summary_of: af8792a3c1d04bbe
scope: []
tags:
  - v2
  - ui
  - walk
  - preview
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 5cddcfbc151f8ec4
---

# the why-not picker keeps one exemplar per rung and discloses it, rather than offering every failing item

Settled while building plan:walk seq:56, which asked for this to be settled and the reasoning recorded rather than left inside the choice.

THE TWO OPTIONS THE TASK NAMED. The preview's why-not picker holds one exemplar per rung - the first item, by id, that fails there - and /api/items is sorted by id, so "the first" is stable by construction. That stability is what the owner reported as "can not see changes to why not". Either the picker discloses that it is showing a SPECIMEN rather than the reader's data, or it offers the real failing items and the exemplar becomes a default rather than the only option.

THE RULING: disclose, and keep the specimen. A sentence under the strip, keyed in both string tables as preview.spec - "The strip holds one specimen per gate, the first item by id that fails there, so it holds still while your selection moves. Every item that really spilled is named under Not delivered below, in the order the selector considered it."

WHY, AND WHAT WAS WEIGHED AGAINST IT. A picker over every failing item rebuilds preview.whyn's own objection one axis along: a ladder is a diagnosis of ONE item by construction, and a segmented strip carrying 139 names is not a picker but a list, drawn in a control that can neither bound itself nor say what it dropped. And the rung a reader is actually chasing is rung 6, which now has a list of its own - the Not delivered card names every Selection.spilled entry with its tier, band and cost, in the selector's own order, bounded through the one boundedList and declaring its bound. So "make the real failing items reachable" is satisfied by a surface built for a list, and what the picker owed was only honesty about what it holds.

THE COST, STATED RATHER THAN DISCOVERED LATER. Rungs 1 to 5 still offer no route to a second failing item, and rung 5 (seen) can name none at all because the seen set is resolved server-side and rides on no response. If a reader later needs to walk the items failing an upper rung, the answer is another list, not a longer picker.
