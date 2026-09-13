---
id: TASK-rail-badge-accessible-names-concatenate-and-the-title-added
type: task
title: rail badge accessible names concatenate, and the title added since is ignored because the element has text
status: active
severity: soft
always: false
summary: Navigation buttons announce their label and their count run together as one word, and the attribute added to fix it has no effect.
summary_of: 0ce799d44b91be0a
scope:
  - src/ui/public/screens/parts.js
tags:
  - v2
  - ui
  - wcag
  - accessible-name
  - "plan:wcag"
  - "seq:9"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 2d51cfd5e29fb269
plan: wcag
seq: "9"
state: todo
priority: "3"
---

# rail badge accessible names concatenate, and the title added since is ignored because the element has text

FOUND BY BOTH UI REVIEWS, and PARTIALLY ADDRESSED between them -- which is the point of the row. Row 116 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Rail badge accessible names CONCATENATE: `Doctor38`, `Review queue0`.

WHAT CHANGED AND WHY IT DID NOT HELP. Since report 1, one button gained a `title`. A `title` IS IGNORED FOR THE ACCESSIBLE NAME when the element has text content -- so the attempted fix has no effect on the measured problem, and the problem is unchanged.

THE SUBJECT. This is why conformance here has to be measured rather than assumed from an attribute being present: the attribute is present, and the name is still `Doctor38`.
