---
id: TASK-eleven-font-sizes-a-pixel-type-scale-that-ignores-the
type: task
title: eleven font sizes, a pixel type scale that ignores the browser default, and 250-character lines
status: active
severity: soft
always: false
summary: Text is sized in fixed units so raising the browser's font size does nothing, and lines run about two hundred and fifty characters wide on a large display.
summary_of: d684d981ef598d3e
scope:
  - src/ui/public/styles.css
tags:
  - v2
  - ui
  - typography
  - design-of-record
  - "plan:walk"
  - "seq:156"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 19a7c9560ee0b283
plan: walk
seq: "156"
state: todo
priority: "3"
---

# eleven font sizes, a pixel type scale that ignores the browser default, and 250-character lines

FOUND BY REPORT 1 AND NOT CONTRADICTED BY REPORT 2, which says explicitly that it did not re-measure these and that nothing it saw contradicts them. That qualification is part of the finding. Row 94 of `reports/2026-09-13-the-consolidated-findings.md` (1 sections 4.1-4.4; 2 section 5.3).

WHAT WAS MEASURED, four facts about the type and control system:
- ELEVEN font sizes on one screen, three of them fractional.
- The type scale is in ABSOLUTE PIXELS, so a raised browser default font size does nothing at all.
- 25 distinct button styles across `<main>`.
- `<main>` has `max-width: none`, so paragraphs run to 1,659 px -- roughly 250 characters per line at 1,920 px.

THE ONE THAT IS MORE THAN TASTE. A pixel type scale means a user who has raised their browser font size gets no change whatsoever, which is a user-agent setting the product silently overrides.
