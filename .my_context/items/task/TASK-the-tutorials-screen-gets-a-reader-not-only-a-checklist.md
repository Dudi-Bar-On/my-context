---
id: TASK-the-tutorials-screen-gets-a-reader-not-only-a-checklist
type: task
title: the Tutorials screen gets a reader, not only a checklist
status: deprecated
severity: soft
always: false
summary: "Cancelled unbuilt: the screen this belonged to was replaced by a list and a rendered page in a new tab."
summary_of: b1d5c025f4c5527d
summary_was:
  - 2026-09-05 The Tutorials screen gains a reader that opens one tutorial's markdown through the app's existing renderer, instead of only listing checkmarks.
scope:
  - src/ui/public/screens/tut.js
tags:
  - v2
  - tutorials
  - ui
  - docs
  - "plan:tuts"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: 2026-09-05
checksum: 13d72832a02d453a
plan: tuts
seq: "4"
state: todo
priority: "2"
needs: tuts/2, tuts/3
---

# the Tutorials screen gets a reader, not only a checklist

CANCELLED 2026-09-05 by DEC-the-documentation-and-tutorials-screens-become-one-list-and.
Deprecated rather than done: none of this was built.

WHAT THIS TASK WAS: the in-app tutorial reader; reading moves to a rendered page in a new tab.

The owner replaced both screens with one list of titles that opens a rendered document in a new
browser tab, after the Documentation screen was built to the wrong premise twice and the Tutorials
screen once. This work is not deferred - the screen it belonged to no longer exists.

Nothing already paid for is lost: the vendored renderer, the fence fix, the ten generated SVG
diagrams and the reading typography all serve the full-page view instead, and serve it better.

Its scope still names a deleted file. That is left as written and acknowledged rather than
re-scoped: this item governed a screen that no longer exists, so there is no path that replaced it,
and rewriting the glob would make the record claim it was about something else.
