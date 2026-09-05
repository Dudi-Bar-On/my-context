---
id: DEC-the-documentation-screen-is-a-help-system-built-from-the
type: decision
title: the documentation screen is a help system built from the readmes, not a browser over every corpus document
status: active
severity: soft
always: false
summary: The screen teaches from README.md and its Hebrew mirror, drawings included; it is not an index of every document the corpus happens to watch.
summary_of: 62aef32f0132b757
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
valid_until: null
checksum: 274fb16c87bbaa4a
---

# the documentation screen is a help system built from the readmes, not a browser over every corpus document

Owner ruling 2026-09-05, rejecting the design that had just shipped live to his screen.

HIS WORDS: "documentation you have implemented a browser that lists all the corpus documents but
that not was the intention, the goal is to take readme also in hebrew and use the info there to
create a help system including the drawings".

WHAT IS REJECTED: a picker over all 158 manifest documents with a filter box and a heading index
per document. It answered "which documents exist", which nobody asked.

WHAT IS WANTED: a HELP SYSTEM. The two READMEs are the material - English and Hebrew - and the
reader is being taught, not given a directory. The drawings are named as part of it rather than
decoration, which is why their absence was the loudest defect on the screen.

WHY THE WRONG THING GOT BUILT, recorded because it is the general case rather than one lane’s
slip. INSTR-a-screen-is-defined-from-every-document-that-mentions-it exists precisely so a screen
is DEFINED before tasks are cut for it. docsys/5 was written as "rebuild the index from a real
manifest, with deep links" - a task about mechanism, cut without a definition of what the screen
is FOR - and a lane built exactly what it said. The task was accurate and the premise was never
established. Same failure the Tutorials screen had, one screen over, three days apart.

ALSO RULED, on appearance: both screens "look very bad" and the work is to be done with UI/UX
expertise rather than as a side effect of building the data path. Markdown output was rejected on
looks - "very ugly and unreadable, the colors and everything" - with HTML suggested instead. The
source stays markdown (INV-markdown-is-the-source-of-truth, and the READMEs’ derived sections
stop deriving the moment the content forks); what changes is the RENDERED output and its design,
including a different colour set for the cards.
