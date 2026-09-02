---
id: TASK-the-pane-can-be-dragged-wider-with-the-keyboard-too-and
type: task
title: the pane can be dragged wider, with the keyboard too, and remembers it
status: active
severity: soft
always: false
summary: The detail panel can be resized by mouse or keyboard and remembers its width, without breaking if the browser refuses to store it.
summary_of: 2201dbf947ff2855
scope: []
tags:
  - v2
  - ui
  - pane
  - a11y
  - "plan:pane"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 6846ef4b1a0cae34
plan: pane
seq: "2"
state: done
priority: "1"
source: owner, 2026-08-27
---

# the pane can be dragged wider, with the keyboard too, and remembers it

This item tracks state only. The task itself is Task 2 of docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-can-float.md, which carries the tests, the code and the commit message.

A `role="separator"` handle with `aria-controls`, `aria-valuenow` and a visible focus ring -- a control that can be focused and shows nothing is a control a keyboard user cannot find. Arrow keys move it in aimable steps; Home restores the shipped default, so a bad drag is one keystroke to undo.

The width is REMEMBERED per browser, and every failure mode of that is a test: a stored value that is not a width is ignored, and storage that THROWS (a private window, blocked site data, a full quota) does not take the pane down with it. Remembering a width is a convenience and a convenience may not break the product.

`pointerdown` plus `setPointerCapture`, not `mousemove` on the document, so a pointer that leaves the window still ends the drag.
