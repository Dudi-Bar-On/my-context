---
id: DEC-a-screen-with-no-verdict-yet-draws-the-unmeasured-mark-never
type: decision
title: a screen with no verdict yet draws the unmeasured mark, never a blank badge
status: active
severity: soft
always: false
summary: Procedures, Export/import and Template packs say their verdict is not yet judged, in the same shape Learn uses for an unmeasured row.
summary_of: 34c7deaf3a1d79e9
scope: []
tags:
  - v2
  - ui
  - walk
  - screens
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: d8ab24906d9b04d4
---

# a screen with no verdict yet draws the unmeasured mark, never a blank badge

Owner ruling 2026-09-05, walk/108, taken in the screen walkthrough after the Template packs badge
was observed live and found to be an EMPTY LINE rather than an absent element.

THE THREE SCREENS. Procedures, Export / import and Template packs are the only three of twenty
that state no verdict. The reason is real — what "implemented" means for them has not been
decided, which is walk/127, /129, /130 and /131 — so the honest answer is not to invent one.

WHAT WAS RULED. They draw the UNMEASURED MARK, the same one Learn’s categories row earned on
2026-09-05: a stated "not yet judged" rather than an empty badge. Not a removed badge either,
which would make three screens silently unlike the other seventeen for a reason a reader cannot
see.

WHY. A blank badge is indistinguishable from a rendering fault, and this project has already
spent a walkthrough item on exactly that confusion (walk/34: doctor draws a card headed error
containing nothing, which reads as an error). INV-nothing-is-dropped-silently is the invariant;
an empty line where a judgement belongs is a silent drop wearing the shape of a judgement.

THE SHAPE IS SHARED, NOT COPIED. Learn’s mark and these three are the same component and the same
strings, so a reader who has learned what the mark means on one screen knows it on the others.
A test asserts every screen’s badge is either a real verdict or the unmeasured mark — never
blank — so this cannot regress to an empty line again.
