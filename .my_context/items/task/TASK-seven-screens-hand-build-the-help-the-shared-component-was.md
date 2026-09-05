---
id: TASK-seven-screens-hand-build-the-help-the-shared-component-was
type: task
title: seven screens hand-build the help the shared component was created to carry
status: active
severity: soft
always: false
summary: The circled question mark exists and is used on one screen, while seven others carry their own copies of it.
summary_of: 2c58faeb437256d2
scope:
  - src/ui/public/screens/**
  - src/ui/public/lib/disclosure.js
tags:
  - v2
  - archive
  - ui
  - "plan:screens"
  - "seq:23"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 3d73f8aeb8e93a4e
plan: screens
seq: "23"
state: todo
priority: "2"
---

# seven screens hand-build the help the shared component was created to carry

Measured 2026-09-05. Of 21 screens, ONE imports the shared component - coverage.js - and
seven hand-build the same idea: ask, config, decay, doctor, preview, simulate and work. The
remaining thirteen offer no help at all.

The component was built on the owner’s instruction that a screen explains itself in plain
words with depth behind a circle, and its whole argument was that a reader who learns it on
one screen knows it everywhere. That is not true while seven screens each carry their own,
and it stops being true the moment an eighth invents a ninth shape.

What to do: move the seven onto src/ui/public/lib/disclosure.js and delete their local copies.
This is consolidation and not redesign - the words stay, the mechanism is shared.

Where a screen’s existing help is denser than the standard allows, say so and leave it rather
than rewriting it here. Reworded prose belongs with the screen’s own walkthrough, where the
owner is looking at it, not smuggled in behind a refactor.

The component is a real details and summary pair with no listeners, so keyboard reach comes
free and must not be lost. Verify in a browser, both languages, and count the screens using
it before and after.
