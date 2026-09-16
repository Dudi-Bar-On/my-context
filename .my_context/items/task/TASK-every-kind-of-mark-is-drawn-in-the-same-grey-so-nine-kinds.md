---
id: TASK-every-kind-of-mark-is-drawn-in-the-same-grey-so-nine-kinds
type: task
title: every kind of mark is drawn in the same grey, so nine kinds are indistinguishable at a glance
status: active
severity: soft
always: false
summary: Bookmarks are no longer all drawn in the same grey; colour now says what a mark is for, in four groups, and the symbol and the word still carry it when colour cannot.
summary_of: b9288aed0a67212c
summary_was:
  - 2026-09-16 A table, a ruling, a defect and a note all look identical in the list — you have to read each one to tell them apart.
scope:
  - src/ui/public/styles.css
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
  - e2e/**
tags:
  - v2
  - recall
  - ui
  - "plan:anchors"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 2264e98a15dff657
plan: anchors
seq: "9"
state: done
priority: "1"
verified_on: 2026-09-16
---

# every kind of mark is drawn in the same grey, so nine kinds are indistinguishable at a glance

OWNER REQUEST 2026-09-15: "let’s have the different anchores types different marking color or emoji
or text (a combination is fine) to fast observe between them".

HALF OF IT ALREADY EXISTS AND THE OTHER HALF DOES NOT. Every kind already has a GLYPH and a WORD —
▦ a table, ⚖️ a ruling you gave, ☐ something to do, ❓ a question, 🐞 a defect, 🔎 evidence, ☑ a
decision, a note, a report. What is missing is COLOUR: `.convanchorkind` and `.tvanchorkind` are
both `color: var(--dim)`, ONE GREY FOR ALL NINE, on the row and in the document alike.

WHY IT MATTERS HERE MORE THAN IT WOULD ELSEWHERE: his archive is 1,155 marks and 779 of them are
tables — 67%. The list is dominated by one kind, in one colour, so the rarer kinds he actually
wants (a ruling he gave, a defect) are needles in a grey haystack.

THE CONSTRAINT THAT DECIDES IT, AND IT IS NOT NEGOTIABLE: `DEC-the-meaning-hue-budget-is-five`
fixes the palette at gold / ok / carry / crit / warn. NINE KINDS DO NOT GET NINE COLOURS. Either
the kinds group onto the hues that exist (and the grouping means something a reader can state), or
colour carries less than the glyph does and says so. A tenth hue is not available and inventing one
is how a palette stops meaning anything.

AND COLOUR IS NEVER THE ONLY CARRIER. The glyph and the word both stay: `@media print` flattens
every hue to #000, and a reader who cannot separate green from orange must still be able to scan
the list. That is the same rule the review verdicts follow — rail, ground, weight AND word.

A SMALLER THING WORTH FIXING IN THE SAME PASS: `conv.anchors.kind.ruling` reads "a ruling you
gave", which is provenance, not a kind — and the row already says "marked for you" one field
along. `kind.note` was moved off exactly that duplication on 2026-09-15.

THE MEASUREMENT THAT CLOSES IT: a list holding several kinds, and a statement of how a reader tells
two of them apart WITHOUT READING THE WORD — at the same contrast the rest of the screen is held
to, in both themes, and in Hebrew where the glyph and the word swap sides.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `2f25357c`. THE GROUPING, IN ONE SENTENCE: colour says what a mark is FOR. Gold, a judgement that was made; orange, something still owed; blue, material the conversation produced; and a plain note keeps the standing grey, because it claims nothing beyond "here". Three hues spent of the five the palette allows, two left on purpose — so nine kinds did not get nine colours, which this item forbade.

AND `--crit` IS NOT SPENT BECAUSE IT CANNOT BE: measured 4.06:1 against the marks card's REAL ground, under the 4.5 bar this project holds every control to, so a defect wears `--warn` with the other debts and its glyph separates it. Gold 8.07, dim 6.51, carry 5.89, warn 5.52, with ΔE76 between any pair 31–118. Print flattens to one ink and the glyph and the word both stay. Closed by the reconciliation in `rulings/93`.
