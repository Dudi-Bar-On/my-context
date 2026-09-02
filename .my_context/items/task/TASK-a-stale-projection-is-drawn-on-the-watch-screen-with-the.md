---
id: TASK-a-stale-projection-is-drawn-on-the-watch-screen-with-the
type: task
title: a stale projection is DRAWN on the watch screen, with the remedy the server already sends
status: active
severity: soft
always: false
summary: The server explains clearly why a screen has no data and the screen shows nothing; draw the explanation, and the one command that fixes it.
summary_of: f1782da6d0fd018c
scope: []
tags:
  - v2
  - ui
  - watch
  - a11y
  - owner-reported
  - "plan:walk"
  - "seq:53"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 49a686e4832791d6
plan: walk
seq: "53"
state: done
priority: "1"
source: measured 2026-08-27 from the owner report
---

# a stale projection is DRAWN on the watch screen, with the remedy the server already sends

Found while measuring the owner's "the audit stream is blank" report on 2026-08-27.

`/api/watch/volume` answers 503 on the real corpus right now, and the body is EXCELLENT -- it names the cause, the constraint and the remedy:

    "the audit projection is behind relative to its log, and this endpoint may not
     catch it up: syncing is a write, and answering from it anyway would present a
     partial history as a complete one. Run `mycontext audit` to build it; a read
     surface may not, because building it ..."

**The server is being clear and the screen is silent.** `watch.js` HAS a `pulseFault` region, so the machinery exists; what is not established is whether it fires and is visible on this path. That is the first thing to measure, in a browser, on the real corpus -- not by reading the code.

WHY THIS IS THE WORSE HALF OF THE BUG. A blank pulse reads as "nothing happened". A drawn refusal reads as "this needs one command and here it is". The difference is one `errorNote` reaching the screen, and the owner spent his attention on a bug report that the product could have answered itself.

DONE WHEN: on a corpus whose projection is behind, the watch screen SHOWS the refusal, in the server's own words, with `mycontext audit` reachable from it -- and a browser test asserts that, because this is exactly the class no unit test sees.

ROOT CAUSE IS A THIRD THING and is already ruled: the projection stales because every read appends and nothing re-syncs. plan:walk seq:28 ruled that THE WRITER keeps it current. Until that lands, this refusal will be seen often, which is the argument for drawing it well rather than for hurrying past it.
