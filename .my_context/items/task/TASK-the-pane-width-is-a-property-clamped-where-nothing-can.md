---
id: TASK-the-pane-width-is-a-property-clamped-where-nothing-can
type: task
title: the pane width is a property, clamped where nothing can escape it
status: active
severity: soft
always: false
summary: Move the panel's width into one place with the limit built in, so no future change can squeeze the page down to nothing.
summary_of: 7ac637e5c9edc092
scope: []
tags:
  - v2
  - ui
  - pane
  - "plan:pane"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 419a87f0109b59b7
plan: pane
seq: "1"
state: done
priority: "1"
source: owner, 2026-08-27
---

# the pane width is a property, clamped where nothing can escape it

This item tracks state only. The task itself is Task 1 of docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-can-float.md, which carries the tests, the code and the commit message.

Changes NO behaviour, and is separated for exactly that reason: a reviewer can confirm the layout is untouched without reading a drag handler, and the two tasks after it are then three lines each.

The `clamp` goes in the grid TEMPLATE rather than in the handler. A value written by anything at all -- a stale store, a future feature, a bug -- then cannot leave the body without room, and the guarantee does not depend on whichever code happens to be writing the property today.
