---
id: DEC-a-refresh-keeps-the-reader-s-place-or-it-asks
type: decision
title: a refresh keeps the reader’s place, or it asks
status: active
severity: soft
always: false
summary: A page that updates itself must not move what you were reading; if it cannot keep your place, it waits and offers you the update instead.
summary_of: db997d658b533573
scope: []
tags:
  - v2
  - ui
  - live
  - a11y
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 5f432cf83f72c160
---

# a refresh keeps the reader’s place, or it asks

Taken 2026-08-27 while specifying REQ-a-served-page-reflects-the-corpus-as-it-changes-without.

THE TENSION. A page that updates itself is the point of the requirement. A page that updates itself WHILE SOMEBODY IS READING IT takes away their scroll position, their open item pane, their selection and, on a long table, the row they were half way through. Both are real, and "refresh everything the moment anything changes" spends the second to buy the first.

THE RULE: **a refresh that can keep the reader's place happens; one that cannot ASKS.**

  - A list whose rows can be replaced in place, with the scroll offset and the open pane preserved, just updates. The reader sees new rows arrive, which is what they wanted.
  - A change that would reorder, re-page or re-fetch under them draws an affordance instead -- one line saying what arrived, and a control to take it. Nothing moves until they press it.

WHY NOT ALWAYS ASK, which is the safe-looking answer: because a page that always asks is a page with a permanent notification nobody reads, and the requirement is that the page REFLECTS the corpus. An affordance on every mutation would make the common case worse to buy safety in the rare one.

WHY NOT ALWAYS REFRESH: this product's readers are looking at long normative bodies. The owner asked for a resizable, floatable pane on 2026-08-27 for exactly that reason -- because item bodies are long. Yanking one out from under a reader mid-sentence is the same defect the pane work exists to fix, arriving from the other side.

THE TEST THAT MAKES IT REAL: with an item pane open and the page scrolled, a mutation arrives; the pane stays open on the same item and the scroll offset does not move. If a screen cannot promise that, it asks -- and which of the two a screen does is a property the screen DECLARES, not one the shell guesses.
