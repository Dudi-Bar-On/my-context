---
id: TASK-the-hue-budget-is-five-and-repaint-task-9-carries-the
type: task
title: the hue budget is five, and repaint task 9 carries the consequences
status: active
severity: soft
always: false
summary: The decision to allow only five colours creates four pieces of follow-up work that the big repaint will inherit.
summary_of: 2f39c147929a46c7
scope: []
tags:
  - "plan:repaint"
  - "seq:9r"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: c1a6d51e056f5e4f
plan: repaint
seq: 9r
state: done
priority: "1"
---

# the hue budget is five, and repaint task 9 carries the consequences

Ruled by the owner 2026-08-22 and written into spec sections 2.4, 2.5, 3.6 and 3.8. Recording the work each ruling creates, because task 9 repaints twenty screens and will inherit all four.

1. --warn is promoted out of the legacy block into the named palette. 25 call sites keep their colour; what changes is that the token is named, measured and documented rather than surviving by accident. Its contrast against the glass has never been measured - repaint task 12 must measure it with the rest.

2. The chip gains a glyph per class: gov diamond-filled, ok circle, warn triangle, crit square, carry diamond-outline. New rules, and a fifth .chip.carry variant that does not exist yet - var(--carry) has zero uses today.

3. --faint is the decoration step. Nothing to build; the checker already enforces it and reports 0 text uses. The spec sentence is what changed.

4. The header is glass: .top becomes .hdr. One class change plus whatever .top's own rule declares that .hdr's shared material would now outrank - the same collision task 3 found and fixed surgically for .pane and .rail.
