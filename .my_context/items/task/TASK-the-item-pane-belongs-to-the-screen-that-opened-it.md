---
id: TASK-the-item-pane-belongs-to-the-screen-that-opened-it
type: task
title: the item pane belongs to the screen that opened it
status: active
severity: soft
always: false
summary: The detail panel should close when you leave the screen you opened it from, instead of following you around and squeezing every page.
summary_of: 7162756ccceca303
scope: []
tags:
  - v2
  - ui
  - pane
  - "plan:pane"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: b4c7e5ba7f3ee2f4
plan: pane
seq: "4"
state: done
priority: "1"
source: owner, 2026-08-27
---

# the item pane belongs to the screen that opened it

This item tracks state only. The task itself is Task 4 of docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-can-float.md, which carries the tests, the code and the commit message.

THE DEFECT THE OWNER REPORTED, and the cause is one missing line rather than a guess:

    grep -c closePane src/ui/public/app.js   ->  3   (declaration, the ✕ handler, Escape)
    route() calls closePane                  ->  false

`installItemPane` delegates from the DOCUMENT, so any `[data-id]` opens the pane, and `pane-open` is a class on `.app`, which outlives every screen. Twelve of the twenty-two screens emit no `[data-id]` at all and can only INHERIT it -- and inherit with it the three-column layout that squeezes their body for a panel about an item the user has left.

The fix is `closePane()` at the top of `route()`. The tests are what make it a rule rather than a patch: the same navigation that discards the FLOAT keeps the remembered WIDTH, which is the preference/mode distinction from seq:2 and seq:3 finally earning itself.
