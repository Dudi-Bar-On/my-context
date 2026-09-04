---
id: TASK-the-ask-composer-disables-is-not-correctly-and-never-says
type: task
title: the Ask composer disables `is not` correctly and never says why
status: active
severity: soft
always: false
summary: One filter option is correctly greyed out and nothing tells the reader why; either say so, or make it work.
summary_of: 8da6da459747509b
scope: []
tags:
  - v2
  - ui
  - review
  - "screen:ask"
  - "plan:walk"
  - "seq:36"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 385c05c39f5e136c
plan: walk
seq: "36"
state: done
priority: "3"
source: "plan:review seq:5, the functional UX review, 2026-08-25"
---

# the Ask composer disables `is not` correctly and never says why

FOUND 2026-08-25 by plan:review seq:5, the functional UX review, 2026-08-25. Filed as a REFUSAL WITH NO WORDS, not as a bug -- the behaviour is right and the silence is the defect.

WHAT A USER SEES: they pick `kind` in the Ask filter row, open the operator select, and `is not` is greyed out. Nothing on screen explains it. Measured: `is not` is DISABLED for `kind`, `op`, `origin` and `item` -- every field the demo corpus offers.

WHY IT IS RIGHT, from `screens/ask.js`: neither `corpusSelect` nor `filterSelect` emits `<>`; they are equality, LIKE and range predicates only. On the three fields whose vocabulary is CLOSED and holds exactly two members -- `layer`, `always`, `scoped` -- the negation IS the other member and is sent as that equality. Everywhere else the option is disabled "rather than silently sent as `is`, which would answer a different question from the one on screen and report it as the same one". That is this project s central invariant applied exactly, and `filterParam` returns the literal string `unserved` so a caller cannot fall back to the positive form by accident.

SO DO NOT "FIX" IT BY ENABLING IT. The owner s standing goal that a refusal is a state to leave has two exits and this one takes the other: either the server learns to emit `<>` (a real feature, and the honest way out), or the screen SAYS WHY the option is grey.

THE MINIMUM IS A SENTENCE. One keyed string, shown when the selected field is not negatable: this surface can only ask "is not" where the vocabulary is closed and has two members, because the query builder behind it emits no `<>`. Mockup first, then both tables.

AND IT INTERACTS WITH `plan:ui3 seq:15`, the typed-SQL surface: once a person can type SQL they CAN write `<>`, so the filter row will refuse what the box beside it accepts. That is defensible and it needs saying out loud in the same sentence, or it reads as a bug.
