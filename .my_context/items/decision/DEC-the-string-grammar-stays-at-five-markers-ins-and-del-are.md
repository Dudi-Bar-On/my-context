---
id: DEC-the-string-grammar-stays-at-five-markers-ins-and-del-are
type: decision
title: the string grammar stays at five markers; ins and del are named, not performed
status: active
severity: soft
always: false
summary: A sentence that describes how changes are highlighted keeps describing it, rather than adding two new pieces of grammar used once each.
summary_of: 5d493f7fbeb23469
scope:
  - src/ui/public/strings/en.js
  - src/ui/public/strings/he.js
  - src/ui/public/lib/i18n.js
tags:
  - v2
  - ui
  - strings
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 64dac29b0cbe4ed0
---

# the string grammar stays at five markers; ins and del are named, not performed

Owner ruling 2026-09-06 (plan D9), settling the last question left from walk/16.

THE QUESTION: the frozen mockup writes the treatment INLINE - additions tinted, removals struck,
as real elements inside the sentence describing them - while the shipped string NAMES the marks in
monospace. Should the grammar gain ins and del run markers so the sentence can perform what it
describes, the way b and i already let it?

RULED: NO. The grammar stays at five markers.

AND THE ITEM ARGUED AGAINST ITSELF CORRECTLY, which is why this was quick. A marker built for ONE
sentence is a grammar growing by accident. Measured: b and i carry 301 placements across the two
string tables and have earned their keep many times over; ins and del would earn theirs twice.
Two new markers in the grammar, the parser and both tables, plus a nesting rule to decide - the
emphasis markers nest and the other three do not - is real cost against one sentence being more
vivid.

WHAT IS ALREADY TRUE AND IS NOT AT STAKE. The FACTUAL half is correct in both languages: both say
the diff is line-level, matching lineDiff in core/revision-diff.ts, which is a line-level LCS and
the only diff in src/. Only the frozen drawing still says word-level - and a frozen reference is
allowed to hold an outdated sentence, which is the whole point of freezing it.

SO THE DIVERGENCE FROM THE MOCKUP IS DELIBERATE AND RECORDED HERE, rather than left as a finding
someone re-raises. The app is what is built; the mockup is history and a gap list.
