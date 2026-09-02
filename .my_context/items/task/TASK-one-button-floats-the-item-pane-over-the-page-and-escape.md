---
id: TASK-one-button-floats-the-item-pane-over-the-page-and-escape
type: task
title: one button floats the item pane over the page, and Escape steps back
status: active
severity: soft
always: false
summary: A button lets the reading panel expand out over the page when you need more width, and Escape brings it back.
summary_of: b73aa622249f7393
scope: []
tags:
  - v2
  - ui
  - pane
  - a11y
  - "plan:pane"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 671fbc4bb5835089
plan: pane
seq: "3"
state: done
priority: "1"
source: owner, 2026-08-27
---

# one button floats the item pane over the page, and Escape steps back

This item tracks state only. The task itself is Task 3 of docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-can-float.md, which carries the tests, the code and the commit message.

In the pane head, BEFORE the close button: ✕ stays last because it is the destructive one and it keeps its corner.

While it floats the grid returns to TWO columns -- otherwise the body keeps a 330px hole where the pane used to be, and giving the body its width back was the point.

IT IS AN EXPANDED PANE, NOT A MODAL, and that is a decision rather than an omission: no backdrop, no focus trap, the rail and body stay usable behind it, and Escape steps back one level. A modal would take the screen hostage to solve a reading-width problem, and this project already rules that a refusal is a state to leave. A `<dialog showModal>` is the obvious way to get there by accident; do not.
