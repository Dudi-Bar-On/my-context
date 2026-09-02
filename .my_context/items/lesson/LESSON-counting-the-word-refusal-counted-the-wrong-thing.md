---
id: LESSON-counting-the-word-refusal-counted-the-wrong-thing
type: lesson
title: counting the word refusal counted the wrong thing
status: active
severity: soft
always: false
summary: Counting a word to rank things inherits every meaning that word has, so the ranking can put the strongest example near the bottom.
summary_of: 8177c31e17c7155e
scope: []
tags:
  - v2
  - ui
  - measurement
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: fe520430ea41e3ff
---

# counting the word refusal counted the wrong thing

Found 2026-08-25, walking packs, one screen after quoting the number.

Asked which screens might be least DEFINED, a proxy was built: count refusal-language in each screen module s header, on the reasoning that a refusal is its author saying what could not be built. The ranking was reported to the owner as evidence: docs 14, packs 10, simulate 8, work 8, and gaps/injected/tut zero.

docs was right -- read in full, it carries fourteen genuine unbuilt-feature refusals.

PACKS WAS WRONG. Its header uses refusal language throughout because REFUSING IS WHAT THE SCREEN DOES: `refusePackName`, `refusePackConfig`, refusing an unsafe manifest, refusing to serve a bad name. Those are behaviours it HAS, not features it lacks. packs is the best-defended screen in the product and the proxy ranked it second-least-defined.

THE GENERAL FORM, and this project keeps meeting it: a proxy is a claim that one thing correlates with another, and it inherits every meaning of the token it counts. "Refusal" means both "I could not build this" and "I will not accept that" in this codebase, and nothing in a regex knows the difference.

WHAT SHOULD HAVE HAPPENED: the proxy was cheap and the ranking had six entries. Reading two of them before quoting the list would have cost minutes and caught it. It was quoted first and read second, which is the same order that produced "21 of 21 screens" the same afternoon.

The rest of that ranking -- simulate 8, work 8, coverage 4 -- is UNVERIFIED and should not be repeated until each is read.
