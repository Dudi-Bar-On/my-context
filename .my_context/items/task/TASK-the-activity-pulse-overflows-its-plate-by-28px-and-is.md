---
id: TASK-the-activity-pulse-overflows-its-plate-by-28px-and-is
type: task
title: the activity pulse overflows its plate by 28px and is clipped
status: active
severity: soft
always: false
summary: The activity chart is drawn larger than the box holding it, so its tallest bars are cut off and it looks plausible while being wrong.
summary_of: 3121a594bccc3e71
scope: []
tags:
  - v2
  - ui
  - "screen:watch"
  - layout
  - e2e
  - "plan:walk"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 2c3eb31f36771f3b
plan: walk
seq: "9"
state: done
priority: "1"
source: "plan:port seq:98, fixture fix fallout"
---

# the activity pulse overflows its plate by 28px and is clipped

FOUND 2026-08-24, the moment the demo corpus stopped refusing. THE SUITE IS RED ON THIS and is meant to stay red until it is fixed.

  the pulse SVG is 36.375px in an 8px content box
  e2e/app-layout.spec.ts, both chromium and chrome

The design of record draws `#pulse` host 34, svg 8, padding 12px 13px, box-sizing border-box -- measured in both files 2026-08-22. The app s SVG is not resolving to the box it is given: it overflows by 28px into a plate that clips it, and the chart loses its tallest columns. That is one of the two silent failure modes the test names in its own header, and it is the one that leaves a chart looking plausible while it is wrong.

WHY IT WAS INVISIBLE. The assertion is guarded: `if (box.svgH !== null)`. The comment above the guard says why, and it is honest -- "The SVG is only drawn when the volume endpoint answers; when it refuses, the plate carries the refusal beside it instead and there is no chart to measure." With the audit projection behind, the endpoint refused, no chart was drawn, and the block was skipped on every run. A guard that keeps a test HONEST also keeps it SILENT, and nothing said which of the two was happening.

DO NOT FIX THIS BY WIDENING THE TOLERANCE. The header already records that an earlier version demanded a 20px minimum which the design itself fails; the invariant is not a height, it is that the SVG resolves to its box. 28px is not tolerance, it is the defect.

SEQUENCED AGAINST THE FREEZE: this is a screen file, and screen files are frozen while plan:port seq:98 measures. The measurement of 2026-08-24 was taken with the defect present, so fixing it changes that baseline -- do it deliberately and re-measure watch, rather than slipping it in.
