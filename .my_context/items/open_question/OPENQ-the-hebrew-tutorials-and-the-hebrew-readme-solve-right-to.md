---
id: OPENQ-the-hebrew-tutorials-and-the-hebrew-readme-solve-right-to
type: open_question
title: the hebrew tutorials and the hebrew readme solve right-to-left two entirely different ways
status: active
severity: soft
always: false
summary: The two Hebrew document families use completely different mechanisms to keep code readable inside Hebrew prose, and nothing says which is intended.
summary_of: ec3f0838d7a9eeab
scope:
  - docs/tutorials/**
  - docs/README.he.md
tags:
  - v2
  - i18n
  - docs
  - rtl
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: dace4ec6717ce357
---

# the hebrew tutorials and the hebrew readme solve right-to-left two entirely different ways

Measured 2026-09-06, the moment the Hebrew tutorial set was completed and the two families could
be compared as wholes:

                          RLM U+200F   NB-hyphen U+2011   dir= attributes
  docs/tutorials/*.he.md         343                246                 0
  docs/README.he.md                0                  0             1,860

Disjoint. Not a majority and a few strays - neither family contains a single instance of the
other’s mechanism.

BOTH ARE LEGITIMATE and neither is a defect on its own. The READMEs wrap identifiers in real
elements: <span dir="ltr">, and <div dir="rtl"> around blocks. The tutorials use invisible
formatting characters: a right-to-left mark before a Latin identifier that opens a line or
sentence, and a non-breaking hyphen joining a Hebrew prefix to a Latin word (ב‑, מ‑, ל‑).

WHY IT MATTERS NOW, and it did not before. Both are served by the SAME viewer since the
documentation screens became one Library opening /doc.html. The README’s dir= spans are real
elements the sanitizer admits and the browser lays out; the tutorials’ marks are characters the
font and the bidi algorithm resolve. A reader moving between a tutorial and the README is reading
two different implementations of the same idea, and anyone editing either has to know which one
applies to the file in front of them - with nothing in either file saying so.

THE MEASURED CONSEQUENCE IS ONE THE TUTORIAL LANE FOUND AND IS WORTH KEEPING: U+200F is not
JavaScript s, so an enumeration written with RLM separators is not read as a joined run by the
fact-checking extractors, and a Hebrew key list cannot trip the profile gate the way an English
comma list can. That is an argument FOR the tutorial convention, discovered rather than designed.

WHAT THIS ITEM IS NOT. It is not a request to convert one family to the other - that is 24 files
or 1,860 attributes and should not happen as a side effect of noticing. The question is which
convention this project uses for Hebrew documents, written down once, so the next Hebrew file does
not pick by looking at whichever neighbour it happened to open.
