---
id: TASK-rebuild-the-documentation-screen-s-index-from-a-real
type: task
title: rebuild the Documentation screen's index from a real manifest, with a working deep link per document
status: deprecated
severity: soft
always: false
summary: "Cancelled unbuilt: the screen this belonged to was replaced by a list and a rendered page in a new tab."
summary_of: 51ec4f88ba062be8
summary_was:
  - 2026-09-05 Replace the screen's five hard-coded contents entries with a real, derived document index and a link that lands on one section.
scope:
  - src/ui/public/screens/docs.js
  - src/ui/read-model.ts
  - src/ui/server.ts
tags:
  - v2
  - ui
  - documentation
  - "screen:docs"
  - "plan:docsys"
  - "seq:5"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/5.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: 2026-09-05
checksum: 8a2f76ce40e4b1b4
plan: docsys
seq: "5"
state: todo
priority: "2"
needs: docsys/2,docsys/3,docsys/4,walk/25
---

# rebuild the Documentation screen's index from a real manifest, with a working deep link per document

CANCELLED 2026-09-05 by DEC-the-documentation-and-tutorials-screens-become-one-list-and.
Deprecated rather than done: none of this was built.

WHAT THIS TASK WAS: the in-app index over every corpus document; the list page replaces it.

The owner replaced both screens with one list of titles that opens a rendered document in a new
browser tab, after the Documentation screen was built to the wrong premise twice and the Tutorials
screen once. This work is not deferred - the screen it belonged to no longer exists.

Nothing already paid for is lost: the vendored renderer, the fence fix, the ten generated SVG
diagrams and the reading typography all serve the full-page view instead, and serve it better.

Its scope still names a deleted file. That is left as written and acknowledged rather than
re-scoped: this item governed a screen that no longer exists, so there is no path that replaced it,
and rewriting the glob would make the record claim it was about something else.
