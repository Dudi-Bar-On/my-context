---
id: STD-the-precedence-order-when-four-sources-of-truth-disagree
type: standard
title: the precedence order when four sources of truth disagree
status: active
severity: hard
always: false
summary: Which record wins when several disagree, why the most recent usually does, and why one of them saying nothing is not the same as saying no.
summary_of: 5ed551ff95786b74
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - process
  - documentation
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 5696b4436c6fbb82
---

# the precedence order when four sources of truth disagree

OWNER RULING, 2026-08-25, given when asked where the specification should live. The answer was not "one place" but "in this order, and reconcile".

THE ORDER, highest authority first:

  1. THE CORPUS, and THE APP SCREENS themselves
  2. THE PLANS          docs/superpowers/plans/*.md -- 16 files, ~43,900 lines, 158 tasks
  3. THE SPECS          docs/superpowers/specs/*.md
  4. THE FIRST v2.0 DOCUMENTS

AND ACROSS ALL FOUR: LATER DECISIONS AND FACTS OVERRIDE EARLIER ONES. The order above is really a statement about time -- the corpus and the running screens are NOW, the plans are then, the specs are before that.

WHY THE SCREENS SIT AT THE TOP BESIDE THE CORPUS, and it is worth being precise because it is easy to misread: the corpus is the authority on INTENT -- what was decided and why. The screens are the authority on FACT -- what exists, and what their own module headers record themselves as refusing and why. Both are current. Neither settles the other s question. Where a screen does something no decision covers, that is a FACT to be recorded, not a defect to be reverted -- which is the same ruling as "more than the mockup is usually right, because development did not stop when the drawing was finished".

THE CAVEAT THE OWNER GAVE, and it is the one that decides how to read silence: "not everything was added to it from the beginning". THE CORPUS IS AUTHORITATIVE BUT INCOMPLETE. Corpus silence is NOT corpus denial. Where it says nothing, fall to the plans, then the specs, then the first documents -- and what is found there is then ADDED to the corpus, which is how the corpus stops being incomplete.

WHAT THIS IS FOR: a stable base for the next tasks, without coarse contradictions. Not a perfect merge -- the owner said "hope without many coarse contradictions", and a fine disagreement recorded honestly is better than a coarse one resolved by guessing.

HOW TO USE IT WHEN TWO SOURCES CONFLICT:
- A CONTRADICTION IS A FINDING, not a wording problem. Record which source won and why.
- A COARSE contradiction -- the two describe different products -- stops and goes to the owner. A FINE one -- different words for the same thing -- is reconciled and noted.
- Never resolve a conflict by deleting the loser. The superseded statement is how anybody later understands why the winner reads the way it does.

THE MOCKUP IS NOT IN THIS LIST, deliberately. It is the visual authority under RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done, and that rule is untouched. This order governs BEHAVIOUR -- what a screen is for, what it reads, what it refuses.
