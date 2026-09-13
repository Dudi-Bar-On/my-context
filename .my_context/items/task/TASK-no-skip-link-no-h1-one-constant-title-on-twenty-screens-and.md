---
id: TASK-no-skip-link-no-h1-one-constant-title-on-twenty-screens-and
type: task
title: no skip link, no h1, one constant title on twenty screens, and the first content control is tab stop 23
status: active
severity: soft
always: false
summary: Someone using only a keyboard walks through the whole navigation before reaching anything they came for, and there is no heading or page name to orient by.
summary_of: 2d666e11ada0688b
scope:
  - src/ui/public/index.html
  - src/ui/public/screens/parts.js
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - wcag
  - keyboard
  - "plan:wcag"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 0695912d1c4db664
plan: wcag
seq: "3"
state: todo
priority: "2"
---

# no skip link, no h1, one constant title on twenty screens, and the first content control is tab stop 23

CONFIRMED UNCHANGED BETWEEN THE TWO UI REVIEWS -- report 1 measured it, report 2 re-measured it a day later without having read report 1's figures and found the same defects. Row 23 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED, five separate facts:
- There is no skip link anywhere.
- The first control inside `<main>` is tab stop 23 (report 1) / 24 of 77 (report 2).
- Opening an item does not move focus into the pane, which is 49 tab stops away.
- There are ZERO `h1` elements.
- `document.title` is the constant `mycontext Console` on all twenty screens.

WHAT IT COSTS. A keyboard user walks the whole rail before reaching anything they came for, every time; a screen-reader user has no heading to orient by and no title that distinguishes one screen from another.

WHY IT IS UNDER THIS SUBJECT. The product's Lighthouse accessibility score is 100 and NONE of these five is visible to it -- of 76 audits, 42 were not applicable and 10 are manual-only, so 24 actually ran. Conformance here has to be measured, not inherited from a score.
