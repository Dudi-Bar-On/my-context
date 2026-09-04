---
id: TASK-audit-stream-what-the-screen-is-and-what-implemented-means
type: task
title: "Audit stream: what the screen is, and what implemented means for it"
status: active
severity: soft
always: false
summary: The screen that shows what the project recorded as it happened, as a live feed with an activity chart, filters and a table.
summary_of: 9e2687e5e63c54b9
scope: []
tags:
  - v2
  - ui
  - mockup
  - "plan:walk"
  - "seq:126"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: bb197f5bf22862f8
plan: walk
seq: "126"
state: done
priority: "2"
source: "plan:walk seq:27, from the module header of screens/watch.js on 2026-09-02"
---

# Audit stream: what the screen is, and what implemented means for it

WHAT THE SCREEN IS, so it can be built without opening the mockup. nav.ev -- Audit stream, section data-p="watch". One card, in the design's own order: an activity pulse, its note, the kind filters, the record table, a polite live region and the token-void note. Three sources, each chosen for a reason: the pulse is 120 ten-second columns of record volume; the BACKLOG comes from the query surface, which reads the projection; and the live feed is the shell's ONE shared connection, the only part of this screen that still answers when the projection is stale, which is why it also carries a bounded replay of what the log already held. The live region holds ONE state at a time and the whole point of it is that "nothing since you opened this" and "this corpus has no audit log" used to be one blank screen and are now two sentences. The pulse uses only hues the design of record has already assigned to these kinds and invents none, so four hues cover seven kinds and a column whose total exceeds what its breakdown accounts for keeps the remainder at full height in the faint tone rather than colouring it by guess.

WHAT IMPLEMENTED MEANS: pulse, filters, table, live region and replay all driven from those three sources; the five stream states each drawn as their own sentence; every string keyed so the language toggle reaches it; and no spills pane, ratio bar or context figure, which belong to other screens by the design's own arrangement rather than by omission.

Filed under plan:walk seq:27, condition 3.
