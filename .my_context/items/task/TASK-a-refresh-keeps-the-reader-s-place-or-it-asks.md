---
id: TASK-a-refresh-keeps-the-reader-s-place-or-it-asks
type: task
title: a refresh keeps the reader’s place, or it asks
status: active
severity: soft
always: false
summary: When new data arrives, a page either keeps the reader exactly where they were or offers a button, rather than reshuffling itself under them.
summary_of: 8919d57b5e9bb07a
scope: []
tags:
  - v2
  - ui
  - live
  - a11y
  - "plan:live"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: de6f3aed423d589a
plan: live
seq: "3"
state: done
priority: "1"
source: owner, 2026-08-27
---

# a refresh keeps the reader’s place, or it asks

Implements DEC-a-refresh-keeps-the-reader-s-place-or-it-asks.

WHICH OF THE TWO a screen does is a property the SCREEN DECLARES, not one the shell guesses -- the shell cannot know whether a re-render will reorder rows under somebody.

THE TEST THAT MAKES IT REAL, and it is the acceptance condition: with an item pane open and the page scrolled, a mutation arrives; the pane stays open on the same item and the scroll offset does not move. A screen that cannot promise that draws the affordance instead -- one line saying what arrived and a control to take it, and nothing moves until it is pressed.

The affordance is not a permanent banner. A page that always asks is a page with a notification nobody reads, and the requirement is that the page REFLECTS the corpus.
