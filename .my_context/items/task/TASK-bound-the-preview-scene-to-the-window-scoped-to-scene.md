---
id: TASK-bound-the-preview-scene-to-the-window-scoped-to-scene
type: task
title: bound the preview scene to the window, scoped to .scene
status: active
severity: soft
always: false
summary: With real data a preview grew far taller than the window; it is now kept inside it, a deliberate difference from a design drawn with tiny samples.
summary_of: b190729bdcf74af3
scope: []
tags:
  - "plan:fixes"
  - "seq:5"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 25c7a24160c5857c
plan: fixes
seq: "5"
state: done
---

# bound the preview scene to the window, scoped to .scene

The mockup carries five short samples so nothing needs to bound the scene; 265 real items grew .pair to 5888px in a 779px window. block-size plus grid-template-rows minmax(0,1fr), not max-block-size alone: .pair declares no rows so capping only the container let the implicit row overflow it. Scoped to .scene after an earlier global .pair rule was measured reaching further than the defect. Eight of ten screens are bit-identical before and after. Landed 9d85a57. This departure REMAINS, deliberately: it is a data-volume difference, not a design disagreement.
