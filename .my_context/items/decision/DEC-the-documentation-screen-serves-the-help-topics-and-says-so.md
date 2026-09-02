---
id: DEC-the-documentation-screen-serves-the-help-topics-and-says-so
type: decision
title: the Documentation screen serves the help topics, and says so
status: active
severity: soft
always: false
summary: The documentation page shows the built-in help topics and says so, instead of promising a manual that nobody has written yet.
summary_of: 02528acf986a74f8
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - "screen:docs"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: c0a1756d738c3476
---

# the Documentation screen serves the help topics, and says so

OWNER RULING, 2026-08-25, walking docs. It answers plan:port seq:5c, which had been holding the question open since 2026-08-23 and called it "a ruling rather than a coding decision".

FOR NOW: the screen serves `mycontext help` topics, and `dv.sub` is corrected to say so.

The sentence on screen today reads "The repository s own README, rendered here and addressed by heading ordinal." No endpoint serves the README; it sits outside `src/ui/public/` so the static handler cannot reach it, and the only markdown route is `/api/help/:topic` over four topics. The deep-link half has nowhere to land either -- `#/docs/4` is not a route the shell parses. The screen has been drawing a promise about a feature nobody built.

WHY THE HELP TOPICS ARE THE RIGHT ANSWER for now: they ARE the product s own documentation, they are already served, already translated, and already the thing a reader needs in the UI. Restating the sentence makes the screen true today at the cost of one string.

AND IT IS EXPLICITLY NOT THE END STATE. The owner ruled in the same breath that a full application documentation is to be built -- see the task of the same date -- from the README, the app s own docs and the application itself, in English AND Hebrew, so that this screen becomes the place a user finds every detail about what the app is, how to use it and how to configure it. This ruling buys honesty now; it does not settle what docs is for.
