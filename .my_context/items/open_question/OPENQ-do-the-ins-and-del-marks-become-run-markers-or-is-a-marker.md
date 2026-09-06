---
id: OPENQ-do-the-ins-and-del-marks-become-run-markers-or-is-a-marker
type: open_question
title: do the ins and del marks become run markers, or is a marker for one sentence a grammar growing by accident
status: deprecated
severity: soft
always: false
summary: One sentence describes a visual treatment instead of performing it, and fixing that would add a marker used nowhere else.
summary_of: 1c9736f4084f7271
scope:
  - src/ui/public/strings/en.js
  - src/ui/public/strings/he.js
  - src/ui/public/screens/work.js
tags:
  - v2
  - ui
  - i18n
  - strings
  - walk
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: 2026-09-06
checksum: f224a6df6d88781e
---

# do the ins and del marks become run markers, or is a marker for one sentence a grammar growing by accident

Split out of walk/16 on 2026-09-05, which is closed. That task carried two halves that are both
settled and this question, which is neither settled nor about the mockup being editable.

THE DIFFERENCE, in the two files as they stand:

  the drawing   ...additions are <ins>tinted</ins>, removals are <del>struck</del>...
                real elements INSIDE the sentence, so the reader sees the treatment
                in the sentence describing the treatment.

  en.js         ...additions are tinted, removals are struck, both real {m:<ins>} and
                {m:<del>} elements...
                the marks are NAMED in monospace. The sentence says what happens; it
                does not show it.

THE QUESTION. The string grammar already carries {b:} and {i:} run markers, added 2026-08-25 and
populated in both languages on 2026-08-27. Do {m:<ins>} and {m:<del>} become run markers too, so
the shipped sentence can demonstrate the marks the way the drawing does?

THE ARGUMENT FOR. It is the same shape as {b:} and {i:} and the same reasoning applies: the design
of record uses the treatment inline, and no string table can carry a raw element. A sentence about
a visual treatment is more legible when it performs it than when it names it, which is the whole
reason the drawing does it that way.

THE ARGUMENT AGAINST, and walk/16 stated it against itself rather than burying it: unlike emphasis
these appear ONCE, in ONE sentence. A marker built for one sentence is a grammar growing by
accident. {b:} and {i:} earned their place across 57 placements; this would earn its place across
two.

WHAT IS NOT AT STAKE, so this is not re-litigated. The mockup is frozen and is not to be edited
either way (DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written). And the factual half is
already correct in the product: both string tables say the diff is line-level, matching lineDiff in
core/revision-diff.ts, which is a line-level LCS and the only diff in src/. Only the frozen drawing
still says word-level, and a frozen reference is allowed to hold an outdated sentence.
