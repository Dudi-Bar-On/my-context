---
id: DEC-help-is-written-for-controls-a-reader-cannot-infer-and-the
type: decision
title: help is written for controls a reader cannot infer, and the result is judged in the browser afterwards
status: active
severity: soft
always: false
summary: Only controls whose effect is not obvious from their label get help; whether that was enough is decided by driving the screens, not by a count.
summary_of: 38cbf2b554487705
scope: []
tags:
  - v2
  - ui
  - walk
  - help
  - a11y
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 8cc9bf544279fee0
---

# help is written for controls a reader cannot infer, and the result is judged in the browser afterwards

Owner ruling 2026-09-05, walk/0, taken in the screen walkthrough.

THE FINDING. No screen has hover or click help, and most buttons carry none at all.

WHAT WAS RULED, and it has two parts. First, help goes on the controls a reader CANNOT INFER from
the label — gates, tier pickers, the cold-session toggle, the event picker — and not on every
interactive control. A tooltip on a button labelled "Next" teaches nobody anything, and a derived
gate demanding one on all ~200 controls would fill the product with noise that a reader learns to
skip, which costs the help that matters its readership.

SECOND, AND THIS IS THE PART THAT IS NOT A ONE-OFF: the owner asked for it to be RE-CHECKED AFTER
IMPLEMENTATION, by driving the screens in a browser as a user and reporting whether the coverage
is right or more is needed. The judgement of sufficiency is made against the working product, not
against the list of controls that were changed.

WHY THAT SECOND PART MATTERS MORE THAN THE FIRST. "Cannot be inferred" is a judgement, and a
judgement made while writing the code is made by the person who already knows the answer. Reading
the screen afterwards, as someone who does not, is the only way to find the control that seemed
obvious to its author. This is the same reasoning as RULE-a-ui-change-is-not-done-until-a-browser-
test-drives-it, applied to sufficiency rather than to correctness.

IT REUSES lib/disclosure.js, the one shared help component, rather than a second mechanism for
hover. See screens/23, which is already moving the remaining hand-built disclosures onto it.
