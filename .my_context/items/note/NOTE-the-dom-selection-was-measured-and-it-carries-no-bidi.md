---
id: NOTE-the-dom-selection-was-measured-and-it-carries-no-bidi
type: note
title: the DOM selection was measured and it carries no bidi control character, so the ruling stands on a different reason
status: active
severity: soft
always: false
summary: The reason for not copying from the screen turned out to be the wrong reason. What the browser actually copies is clean of hidden marks, but it still cannot reach the parts of a long conversation that are not drawn.
summary_of: f92cd252059f4893
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - measured
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 873c53e95964f1d6
---

# the DOM selection was measured and it carries no bidi control character, so the ruling stands on a different reason

Measured 2026-09-09 by the lane that built `TASK-a-selected-passage-copies-as-something-a-terminal-will`,
because that item asks for a correction to be worth more than an agreement.

WHAT THE ITEM SAYS, AND IT IS THE HALF THAT IS WRONG: *"This UI deliberately inserts bidi control
characters and isolation wrappers - 116 `dir` wrappers were added in one pass, and a Hebrew
conversion removed 344 RLM marks and 249 non-breaking hyphens precisely because they had been pasted
around. A DOM selection copies those invisible characters into the clipboard, and they will travel
into whatever he pastes into."*

THE MECHANISM DOES NOT HOLD, AND HERE IS THE MEASUREMENT.

  - `dir="auto"`, `dir="ltr"` and `<bdi>` are MARKUP, and `.m`/`.v` are `unicode-bidi: isolate` in
    the STYLESHEET. None of them puts a codepoint into a text node, and Chromium's own selection
    serialiser does not synthesise one.
  - Driven in a real browser on the HEBREW page over the owner's own 75,162,876-byte transcript at
    62% depth: 14 rows sampled, 4 of them carrying both Hebrew and Latin text, and
    `Selection.toString()` on ZERO of the 14 carried U+200E, U+200F, U+061C, U+202A-U+202E or
    U+2066-U+2069. On the browser fixture, the same, in both languages.
  - Scanned every shipped browser asset under `src/ui/public` for those codepoints: `app.js` 1,
    `strings/en.js` 1, `strings/he.js` 194 - and EVERY ONE is U+2011 NON-BREAKING HYPHEN, not a bidi
    control. Of the Hebrew hits, 34 are in comments and 160 are in string values across 119 values.

SO THE RESIDUE IS REAL BUT IT IS THE OTHER HALF OF THE PAIR the item names: the non-breaking hyphens
were never removed from the Hebrew table, and 119 string values still carry one. None is a
`conv.doc.*` key - the seven `conv.*` ones are `conv.sub`, `conv.help.body`, `conv.sensitive`,
`conv.missingSome`, `conv.behindRow`, `conv.laneMatch` and `conv.undated`, which are the LIST and
the help rather than anything a transcript row draws. So a rendered copy of a document ROW does not
pick one up today, and a rendered copy of the list would.

WHY THE RULING IS STILL RIGHT, on reasons that were measured rather than assumed:

  1. THE RENDERED FORM CANNOT REACH WHAT IS NOT DRAWN. The document is virtualised, so
     `Selection.toString()` stops at the DOM by construction. Measured on the owner's transcript: a
     passage of 274 sections had 17 rows in the DOM and 259 sections that were never drawn.
  2. IT CARRIES THE PRESENTATION LAYER. A row's rendered text is the speaker's NAME, the timestamp
     and a fold's summary line - on the Hebrew page, `"\n12 פעולות מכונה\nAgent"` for a fold whose
     records are not in it. Pasted into a prompt that is a page ABOUT a conversation, not the
     conversation.
  3. CSS COLLAPSES WHITESPACE and a closed `<details>` is absent from the selection. Both are in the
     item and both are still true.

WHAT A LATER READER SHOULD TAKE FROM THIS: the three forms are right, the default is right, and the
ONE argument that should not be repeated is "the DOM selection is full of invisible characters".
Measured on this engine, on this page, it is not. The argument that carries the weight is that the
screen only holds what is drawn.

NOT MEASURED, and said so the claim is not read wider than it is: Firefox and WebKit were not
driven. The suite pins Chromium and Google Chrome, and both answered the same.

## Relations
- refines [[TASK-a-selected-passage-copies-as-something-a-terminal-will]]
