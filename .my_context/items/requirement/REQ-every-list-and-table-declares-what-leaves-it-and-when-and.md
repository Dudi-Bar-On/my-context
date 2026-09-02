---
id: REQ-every-list-and-table-declares-what-leaves-it-and-when-and
type: requirement
title: every list and table declares what leaves it and when, and says so on screen
status: active
severity: hard
always: false
summary: Every list says how much it is showing, in what order, and what it left out, so a partial view can never be mistaken for the whole thing.
summary_of: 77a6b6157da9375c
scope: []
tags:
  - v2
  - ui
  - owner-requirement
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: 4f6d001ee4c06a9b
---

# every list and table declares what leaves it and when, and says so on screen

OWNER REQUIREMENT, 2026-08-26, given while restructuring the injection preview: "there is a general subject that has to be handled and it is when items in lists and tables are disapearing, otherwise it going inflate without a clear mechanism".

THE REQUIREMENT. Every list, table and tree in the UI has a stated BOUND and a stated DISAPPEARANCE RULE, and the reader can see both. A surface that grows with the corpus and never says what it dropped is two defects at once: it becomes unusable at scale, and it cannot be told apart from a surface that is showing everything.

IT IS THE SAME INVARIANT ONE LAYER OUT. `INV-nothing-is-dropped-silently` governs what the ENGINE drops; this governs what the SCREEN drops. A row omitted for room is as silent as an item spilled without a reason, and the reader has less recourse — nothing is written down anywhere for them to go and check.

THIS PRODUCT ALREADY HAS TWO MECHANISMS THAT WORK, and a third surface is expected to pick one rather than invent a fourth:

  1. THE CAP PLUS A TRUTHFUL SIGNAL -- the Ask screen. The server binds ONE ROW MORE than the cap; that extra row is the truncation signal and is dropped before display; a keyed sentence then says "capped at {v:rows} rows -- more matched; raise the limit to see them". The signal is DERIVED, never guessed, and it distinguishes "exactly N" from "at least N".
  2. THE CAP PLUS AN EXPLICIT REMAINDER -- the Relations ego-graph. A hard cap of 60 nodes and a drawn `+N more` node. The remainder is a VISIBLE OBJECT, not a footnote.

AND FIVE SURFACES HAVE NEITHER, measured 2026-08-26 by reading the render loops:
  `preview.js:424`  `selection.full.forEach` -- the delivered items, uncapped
  `preview.js:552`  the carried-id blocks, uncapped -- 19 to 26 on the owner s own corpus, photographed, pushing two graphics off the screen (`plan:screens seq:1s-e`)
  `injected.js:70`  `for (const line of data.lines)` -- uncapped
  `work.js:458`     `for (const rev of revisions)` -- uncapped
  `packs.js:522`    `for (const pack of body.packs)` -- uncapped

WHAT A COMPLIANT SURFACE MUST SATISFY:
  - A BOUND EXISTS and is a number somebody chose, not an accident of the data.
  - THE READER IS TOLD when the bound bit, and told the TRUE shape: "N shown of M" where M is known, or "at least N" where it is not. Never a bare count that might be either.
  - THE ORDER IS STATED. Which N survived is a decision -- newest, largest, first-fit order -- and a truncation whose ordering is unstated is a sample presented as a summary.
  - THERE IS A WAY TO THE REST, or an honest sentence saying there is not.
  - AN EMPTY LIST IS NOT A BOUNDED LIST. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` already governs zero; this governs the other end.

SCROLLING IS NOT A MECHANISM. `.lit` and `.ladder` bound their HEIGHT with `overflow-y:auto`, which keeps the page usable and tells the reader nothing about how much is below. It is a layout answer to a disclosure question, and it is why the injection preview scrolled to 3,882px against the design s 541 without anything reporting a problem.
