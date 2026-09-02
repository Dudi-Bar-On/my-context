---
id: DEC-hebrew-gets-the-same-emphasis-english-does
type: decision
title: Hebrew gets the same emphasis English does
status: active
severity: soft
always: false
summary: Both languages get the same bold and italic emphasis; flattening one because the translation was awkward would be a choice nobody actually meant to make.
summary_of: 5387a3ec89a95e6b
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - strings
  - i18n
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 42460a9b5aeaf8c4
---

# Hebrew gets the same emphasis English does

OWNER RULING, 2026-08-25, taken in the emphasis walkthrough.

The design of record bolds 65 phrases and italicises 10 -- ALL OF THEM IN ITS ENGLISH MARKUP. Its Hebrew table, `const HE={...}`, is plain strings with no markup in any of them, so switching the mockup to Hebrew drops every piece of emphasis on every screen.

THE RULING: the app does not copy that. Both languages get emphasis.

WHY IT IS NOT SIMPLY 1:1: this looks like a limitation of how the mockup translates -- a string table that replaces text content cannot carry markup -- rather than a decision anyone took. Inheriting it would mean Hebrew readers get measurably flatter prose than English ones for a reason nobody chose. That is exactly the kind of silent inheritance this walkthrough exists to stop.

WHAT WAS WEIGHED AGAINST IT: copying the mockup is shippable today with no input from the owner, and dropping emphasis from both languages would be cheaper still. The second was declined because it spends the typographic hierarchy the design was drawn with, on eighteen screens, to solve a translation problem.

THE CONSEQUENCE FOR THE WORK, and it is a real one: THE HEBREW POSITIONS DO NOT EXIST ANYWHERE. English emphasis is derivable from the mockup s markup and an agent can place it exactly. Hebrew emphasis has no source, and an agent placing it would be pattern-matching a language rather than reading a specification. So plan:walk seq:1 builds the vocabulary and populates ENGLISH, and the Hebrew values are marked as needing the owner rather than guessed.

`strings-parity` compares KEY SETS in both directions, not marker content, so a key carrying emphasis in en and not yet in he is structurally legal while that lasts.
