---
id: DEC-the-documentation-screen-is-a-help-system-built-from-the
type: decision
title: the documentation screen is a help system built from the readmes, not a browser over every corpus document
status: deprecated
severity: soft
always: false
summary: "Superseded the same day: rather than designing a help system in the console, both screens were replaced by a list and a rendered page."
summary_of: 1dd7af2191cf108c
summary_was:
  - 2026-09-05 The screen teaches from README.md and its Hebrew mirror, drawings included; it is not an index of every document the corpus happens to watch.
scope:
  - src/ui/public/screens/docs.js
  - src/ui/public/screens/tut.js
  - README.md
  - docs/README.he.md
tags:
  - v2
  - ui
  - docs
  - "screen:docs"
  - ruling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: 2026-09-05
checksum: e4d9e0922d7685c7
---

# the documentation screen is a help system built from the readmes, not a browser over every corpus document

SUPERSEDED 2026-09-05, the same day, by DEC-the-documentation-and-tutorials-screens-become-one-
list-and. Kept rather than deleted because it records a decision that was really made and really
reversed, and the reversal is the useful part.

WHAT IT RULED. The Documentation screen was to be a help system built from the two READMEs,
drawings included - rejecting the browser over every corpus document that had shipped live.
That rejection still stands and is not undone by the supersession.

WHAT REPLACED IT. Rather than design a help system inside the console, the owner cancelled both
screens: one list page naming documents by title, and reading happens on a rendered page in a new
browser tab, matching GitHub. His reasoning was that both screens had now been built to a premise
nobody could state, and a list plus a rendered page is a definition that fits in a sentence.

Its scope names two deleted files and is left as written: this decision governed a screen that no
longer exists, so no path replaced it.
