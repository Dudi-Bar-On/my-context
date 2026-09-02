---
id: TASK-spec-2-4-contradicts-itself-faint-now-paints-no-text-at-all
type: task
title: "spec 2.4 contradicts itself: --faint now paints no text at all"
status: active
severity: soft
always: false
summary: The written design says the palest ink carries text and the shipped rules give it none; decide which is right rather than shipping both.
summary_of: 1e71236841431903
scope: []
tags:
  - "plan:repaint"
  - "seq:4r"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: c8984a959f2718f7
plan: repaint
seq: 4r
state: done
priority: "1"
---

# spec 2.4 contradicts itself: --faint now paints no text at all

Found by the --faint checker while being made red on the real mockup. Section 2.4 of the visual direction permits --faint at 'column headers, micro-labels, and anything at large-text size' - but a 10px uppercase column header is not large text under any definition, and --faint measures 3.83 where 4.5 is owed below large-text size.

Applying task 4 as written moved all ten text uses to --dim. So --faint now paints only decoration: hatches, borders, SVG strokes. The third ink step carries no text.

The ruling: if the third ink step is MEANT to carry text - which is what section 2.4's own sentence implies - then the VALUE has to move, not the checker. --faint would need to reach 4.5 against the glass, which makes it lighter and closer to --dim, and the owner ruled the three-step ink scale deliberately.

Either answer is defensible. Shipping a spec sentence that the shipped code contradicts is not.
