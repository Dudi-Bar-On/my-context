---
id: REQ-the-ui-serves-and-browses-the-tutorials-and-the-tutorials
type: requirement
title: the ui serves and browses the tutorials, and the tutorials cover every capability from both surfaces
status: active
severity: soft
always: false
summary: Tutorials are read inside the product through the markdown renderer, and together they teach every feature from the terminal and from the screen.
summary_of: 0b436f48abaa3685
scope:
  - docs/TUTORIAL.md
  - docs/TUTORIAL-ADVANCED.md
  - docs/tutorials/**
  - src/ui/public/screens/library.js
  - src/ui/public/doc.js
  - src/ui/server.ts
tags:
  - v2
  - tutorials
  - ui
  - docs
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: afdabc88e8f35ee8
---

# the ui serves and browses the tutorials, and the tutorials cover every capability from both surfaces

Owner requirement 2026-09-05, given after research established that the record contained no
definition of this screen at all and that its scope question had never been asked.

THE ANSWER TO THE PRIOR QUESTION. A tutorial is a thing the UI SERVES. It is not a file you
read in the repository while the screen tells you it exists. Until now the screen was a static
index by default rather than by decision; that is settled.

HOW IT IS SERVED. Through the markdown renderer, which the owner asked for as a feature in its
own right - this is one of its usages rather than a second renderer written for one screen. A
reader browses the tutorial list, basic and advanced, and reads a tutorial in place.

WHAT A TUTORIAL IS. One tutorial per FEATURE of my_context, not per screen and not per command.
Each teaches what the feature is for, how it works, and how to use it - from the CLI and from
the UI - and says what is available in each, because they are not the same and a reader needs
to know which surface can do what.

WHAT THEY MUST COVER: every aspect of my_context. The terminal interface, the CLI, the slash
commands, the categories, and the UI screens - each in the context of using a feature rather
than as a reference list. Together they cover all the app’s capabilities.

BOTH LANGUAGES. They are translated to Hebrew, like everything else this product shows a
reader. Today no Hebrew tutorial content exists at all, which is structural rather than a
screen defect.

AND THEY WILL BE UPDATED. The owner said plainly they may be revised once v2.0 is complete, so
nothing here should be built as though the text were final. What must be durable is the
mechanism that serves them and the check that keeps them true.

WHAT THE RESEARCH ALREADY FOUND, and these are requirements rather than notes. No route serves
a tutorial file to the browser today. The screen’s six rows now check whether a HEADING exists,
which tests existence and not correctness: five documentation-review findings - a stale hook
count, a stale version, wrong budget figures, and a refused config value still being taught -
sit under headings the screen currently marks with a tick. And nothing anywhere gates a
tutorial against drift, so a tutorial can teach a flag that no longer exists and nothing says
so.

This needs a spec, a plan and tasks, covering both halves: the documents themselves and the UI
feature that serves them.
