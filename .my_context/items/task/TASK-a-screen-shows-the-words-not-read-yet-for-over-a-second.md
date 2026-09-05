---
id: TASK-a-screen-shows-the-words-not-read-yet-for-over-a-second
type: task
title: a screen shows the words not read yet for over a second while it is reading, and sets no busy state
status: active
severity: soft
always: false
summary: While a screen fetches its data the whole page is a phrase that reads as a finished, empty result, so a person waiting cannot tell loading from broken.
summary_of: b2818454f5f27584
scope:
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - walk
  - a11y
  - "screen:all"
  - "plan:walk"
  - "seq:139"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: e418d5c1f49fce05
---

# a screen shows the words not read yet for over a second while it is reading, and sets no busy state

Owner request 2026-09-05: "if the server is loading and it takes sometime, use some ui indication
when user waits for the server to come up".

MEASURED on the live server, sampling `main` while switching to Template packs:

    0 ms   47911 chars   the PREVIOUS screen is still drawn
  300 ms      12 chars   "not read yet"
  600 ms      12 chars   "not read yet"
 1000 ms      12 chars   "not read yet"
 1600 ms      12 chars   "not read yet"
 settled     1306 chars   the screen

`aria-busy` was null at every sample. So for roughly 1.2 seconds the ENTIRE screen is the phrase
"not read yet", with no spinner, no progress affordance, and nothing for assistive technology.

WHY THE PHRASE IS THE PROBLEM, not just the absence of a spinner. `screen.unread` is worded as a
SETTLED FACT — a state of not having read — which is indistinguishable from a finished read that
found nothing. app.js argues this exact distinction for the tag vocabulary, citing
LESSON-on-real-data-an-absent-feature-and-a-missing-feature-look: null and empty are different
states and both must be drawn. That argument is right and it stops one level too early. There
are THREE states, not two: reading now, read and empty, and not read. The first is currently
wearing the third’s clothes.

WHAT WOULD CLOSE THIS. A distinct in-flight state with its own key in both string tables, plus
`aria-busy` on the region while a read is outstanding, and a visible progress affordance. The
existing `screen.unread` keeps its meaning and stops being shown during a read.

OUT OF SCOPE, and deliberately: reconnecting to a server that has gone away. The design spec
forbids it — "on exit the server closes the stream and the page says so, and does not
auto-reconnect. Silent reconnection would reintroduce the daemon by another name" — and that case
already has its own shipped answer in the `#exited` banner. This item is about a read in flight
against a server that IS answering.
