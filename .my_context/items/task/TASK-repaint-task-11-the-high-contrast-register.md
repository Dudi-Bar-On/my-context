---
id: TASK-repaint-task-11-the-high-contrast-register
type: task
title: "repaint task 11: the two degraded registers"
status: active
severity: soft
always: false
summary: Make the look hold up for people whose system strips transparency or forces its own colours, instead of falling apart for them.
summary_of: edb6af196a6dc6b2
scope: []
tags:
  - "plan:repaint"
  - "seq:11"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 6bfbed2784a1be15
plan: repaint
seq: "11"
state: done
priority: "1"
source: "my-context/docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md#task-11"
---

# repaint task 11: the two degraded registers

Measured during the icon evaluation: the glass does not survive forced-colors at all - backdrop-filter, both tint gradients and the layered shadow are stripped. SVG fill and stroke are not force-adjusted, so they must be restated by system colour name.

It also honours prefers-reduced-transparency, carried here from review 2: a person who has asked their system for less transparency has asked for exactly the thing this direction is built out of, so the answer cannot be to ignore it.

Task 11 of the web UI visual repaint. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md at line 722 - that file is the authority, and this item tracks state only.
