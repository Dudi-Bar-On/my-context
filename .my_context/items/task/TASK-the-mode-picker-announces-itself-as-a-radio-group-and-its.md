---
id: TASK-the-mode-picker-announces-itself-as-a-radio-group-and-its
type: task
title: the mode picker announces itself as a radio group and its arrow keys move neither focus nor selection
status: active
severity: soft
always: false
summary: A set of options tells a screen reader it can be moved through with the arrow keys, and those keys do nothing at all.
summary_of: aadd6e0ff94834eb
scope:
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - wcag
  - keyboard
  - radiogroup
  - "plan:wcag"
  - "seq:7"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7adbea58e6ef58c8
plan: wcag
seq: "7"
state: todo
priority: "3"
---

# the mode picker announces itself as a radio group and its arrow keys move neither focus nor selection

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`, 2.7) as row 101 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The retrieval mode picker is a CORRECT `radiogroup` with CORRECT `aria-checked` -- and its keys do not work. All four options carry `tabindex="0"` instead of a roving tabindex, and ArrowRight/ArrowLeft move neither focus nor selection.

WHY THAT IS WORSE THAN AN UNLABELLED CONTROL. A screen reader announces "radio button, 3 of 4", which is a PROMISE about how the arrow keys behave. The announcement is correct and the behaviour it promises is absent, so the user is actively misled by a correct label.

THE SUBJECT. The roles and states here were measured and are right; the keyboard interaction pattern the role implies was never implemented, and only a measurement finds that.
