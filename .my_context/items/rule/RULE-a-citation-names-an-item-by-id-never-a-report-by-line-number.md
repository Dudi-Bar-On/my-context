---
id: RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number
type: rule
title: a citation names an item by id, never a report by line number
status: active
severity: soft
always: false
summary: References in the code point at things that keep their name, instead of line numbers that move the next time anyone writes.
summary_of: 6a01f43f8837446b
scope:
  - src/**
  - scripts/**
  - test/**
  - e2e/**
tags:
  - v2
  - governance
  - citations
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: d2e5cf8c985e2c76
---

# a citation names an item by id, never a report by line number

OWNER RULING 2026-09-07, taken from two citations that had BOTH already rotted before anyone noticed.

src/doctor/checks.ts cited reports/EXECUTION-BOARD.md:99 and reports/V2-HANDOVER.md:437 for a
sentence about doctor findings declaring their own remedies. Line 99 held a paragraph about builder
tasks; line 437 held a paragraph about a disconnected browser tool. Neither had held that sentence
for days. It was found only because the board was being retired.

THE MECHANISM IS STRUCTURAL, NOT CARELESSNESS. reports/V2-HANDOVER.md is PREPENDED TO - every write
adds a block at the top - so EVERY line number in it is invalidated by the next write. Now that the
handover is the single place, a line-anchored citation into it is guaranteed to rot, not merely
likely to.

THE RULE: cite the ITEM BY ID. An id is a slugged title, it is addressed by name, and nothing moves
it. Where the target genuinely is a document rather than an item, cite it by ANCHOR - a heading or a
stable phrase - never by line. This is plan:walk seq:30 position, arrived at independently.

THIS IS NOT A BAN ON QUOTING REPORTS. Quote them freely; the quotation carries its own evidence. What
is banned is the LINE NUMBER as the address, because that is the part that silently stops being true.

ENFORCEMENT IS DEFERRED ON PURPOSE, and by his choice: this is filed as a rule now, and
scripts/check-cited-items.ts is the obvious place to catch it later, since it already reads source
citations. Adopting the convention first and mechanising later is the order that lets the mechanism
be built against real practice rather than against a guess.
