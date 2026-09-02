---
id: TASK-the-injection-preview-is-flat-the-tilt-leaves-the-design-of
type: task
title: "the injection preview is flat: the tilt leaves the design of record"
status: active
severity: soft
always: false
summary: A slight tilt on the main screen sheared dense text, so it was removed from the design and the app together.
summary_of: 36de02d9689dae6c
scope: []
tags:
  - "plan:fixes"
  - "seq:4"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: ebf414f6e35b30a2
plan: fixes
seq: "4"
state: done
---

# the injection preview is flat: the tilt leaves the design of record

Of the mockup’s 21 screens, preview was the ONLY one carrying a transform or perspective, and the only card the owner reported as wrong, on the mockup itself. The 3.2 degrees was always exactly 3.2 degrees; at 213 real bodies it sheared dense monospace prose. Removed from web-ui-mockup.html AND styles.css together so styles-parity still holds them byte-identical. primitives.test.ts now guards the flat scene and keeps the structural half: perspective belongs on the container, never on a plane. Landed f33cfdf. See DEC-the-injection-preview-is-flat-the-3-2-degree-tilt-is-removed.
