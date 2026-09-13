---
id: TASK-selection-on-the-mode-picker-is-conveyed-by-colour-alone
type: task
title: selection on the mode picker is conveyed by colour alone, with identical weight and no shape difference
status: active
severity: soft
always: false
summary: Which option is selected is shown only by colour, so someone with colour-vision deficiency cannot see which one is chosen.
summary_of: fe31c093c27e6616
scope:
  - src/ui/public/styles.css
tags:
  - v2
  - ui
  - wcag
  - colour
  - "plan:wcag"
  - "seq:8"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 801138ff235f7fca
plan: wcag
seq: "8"
state: todo
priority: "3"
---

# selection on the mode picker is conveyed by colour alone, with identical weight and no shape difference

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`, 2.8) as row 103 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Selection state on the mode picker differs ONLY in text colour and border colour. `font-weight` is 600 on all four options; there is no shape difference, no icon and no underline.

AND THE HALF THAT IS ALREADY CORRECT, recorded so the scope stays honest: `aria-checked` is present and correct, so assistive technology conveys the selection properly. The affected audience is SIGHTED USERS WITH COLOUR-VISION DEFICIENCY ONLY.

WHY IT IS A MEASURED CONFORMANCE ITEM. "Colour is not the only visual means of conveying information" is a named criterion with a defined test, and this is a measured failure of it on a control whose whole job is to show which of four things is selected.
