---
id: TASK-nineteen-screen-headings-open-with-a-green-tick-that-reads
type: task
title: nineteen screen headings open with a green tick that reads as a health claim, and it blocks the glyph set
status: active
severity: soft
always: false
summary: Most screens open with a tick mark that was meant as an internal design note, and readers take it as a claim that the product is healthy.
summary_of: 6e38e76eb8cdfdcd
scope:
  - src/ui/public/screens/parts.js
  - src/ui/public/strings/**
tags:
  - v2
  - ui
  - glyphs
  - needs-ruling
  - "plan:screens"
  - "seq:27"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: acadb2de39c49b1a
plan: screens
seq: "27"
state: todo
priority: "2"
---

# nineteen screen headings open with a green tick that reads as a health claim, and it blocks the glyph set

THE DECISION COMES FIRST, AND NOBODY CAN START UNTIL IT IS TAKEN. The question is: keep the emoji verdicts on the screen headings, hide them, or reword them. Report 2 recommends REWORD and is explicit that it is a PRECONDITION rather than a courtesy -- `⚠️` currently means "Learn is a conditional pass", any coherent severity set needs `⚠️` to mean WARNING, and one glyph cannot mean both. So the glyph set D63 exists to build cannot start until this is settled.

AND THE QUESTION WAS ALREADY RULED ON ONCE. `parts.js` records a 2026-08-26 verification pass settling that "a real verdict chip is the `.chip` primitive with a meaning hue, not an emoji". Status WAS migrated. The other nineteen screens were left on the default because the change was made opt-in.

WHAT WAS MEASURED, by both UI reviews. Nineteen of twenty-one screens open with `✅` and Status and Learn with `⚠️`. The glyph is a bare text node with NO `aria-hidden` and NO string-table key, so a screen reader announces "white heavy check mark", and a sighted user reads a green tick beside a heading as a health claim about the product. Report 2 adds the mechanism: `screenHead`'s `verdictChip` already exists.

THE SHAPE OF THE RECOMMENDED ANSWER, if reword is chosen: migrate the nineteen to `verdictChip`; keep the sentence where it tells the USER something (`ask.v`, `conv.v`, `gr.v`); delete it where it is an internal design argument (`doc.v`, `cfg.v`, `st.v`, `ln.v`). Costed at four hours.

Row 29 of `reports/2026-09-13-the-consolidated-findings.md`; found by both UI reviews.
