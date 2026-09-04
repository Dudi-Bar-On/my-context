---
id: TASK-port-the-mockup-s-shell-and-all-21-section-skeletons-into
type: task
title: port the mockup’s shell and all 21 section skeletons into index.html
status: active
severity: soft
always: false
summary: Bring the design's full page frame and all of its screens into the app, including the ones not built yet, shown as planned.
summary_of: 9b61f15b3ee9ad9d
scope: []
tags:
  - "plan:port"
  - "seq:1"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 1a30b7017416aece
plan: port
seq: "1"
state: done
---

# port the mockup’s shell and all 21 section skeletons into index.html

Owner decision 2026-08-22: full port. Measured, the app renders 174 elements where the mockup renders 524. The screen CONTENT is faithful - .phd, .psub and .card.pane are the mockup’s own pattern - but the CONTAINER SYSTEM is absent: no section[data-p] wrappers, and styles.css carries ZERO data-p rules where the mockup has .body{display:grid} and .body>[data-p]{grid-column:1;grid-row:1} stacking all 21 screens in one cell to crossfade. The rail is 10 a.nav where the mockup has 21 button.nav in 4 groups; the mockup badges its own not-yet-real screens with span.prop PROPOSED, so showing all 21 with the unbuilt ones badged is the faithful answer. Also brings .prov and footer.strip, whose absence is the 56px band at the bottom of every screen. Verify with a DOM-parity check, not by looking.
