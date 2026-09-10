---
id: STD-the-precedence-order-when-four-sources-of-truth-disagree
type: standard
title: the precedence order when sources of truth disagree
status: active
severity: hard
always: false
summary: Which record wins when several disagree, why the most recent usually does, and why one of them saying nothing is not the same as saying no.
summary_of: 27f8741a135a11e7
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
checksum: 7c1344a44852c6d8
---

# the precedence order when sources of truth disagree

OWNER RULING, 2026-08-25, given when asked where the specification should live. The answer was not "one place" but "in this order, and reconcile".

THE ORDER, highest authority first:

  0. THE PRODUCT RULE STORE  src/rules/entries/*.md -- constants about my_context ITSELF
  1. THE CORPUS, and THE APP SCREENS themselves
  2. THE PLANS          docs/superpowers/plans/*.md -- 16 files, ~43,900 lines, 158 tasks
  3. THE SPECS          docs/superpowers/specs/*.md
  4. THE FIRST v2.0 DOCUMENTS

THE FIFTH SOURCE, ADDED 2026-09-11 -- D41 spec section 9, plan:store seq:2. The product now ships its own store of constants: facts, prohibitions, procedures, standards and definitions about my_context itself, delivered at every door an agent starts through and invisible to a user's corpus. A PRODUCT ENTRY WINS. It states how the tool behaves, which is true whatever anybody records about it -- "a body stops at the first ## heading" is a fact about the write path, not an opinion the corpus can outvote.

AND THE CONFLICT IS REPORTED, which is the half that matters. A silent win teaches a reader their own rule is being obeyed when it is not, so where a product entry and a corpus item claim the same subject the delivered block names both by id and says which one governs. The losing item is NOT deleted, hidden or rewritten -- see the rule further down, which this does not weaken by one word.

IT IS NUMBERED 0 RATHER THAN INSERTED AS A NEW 1, deliberately: every position below it keeps the number it has had since 2026-08-25, so nothing already written that says "the corpus is 1" becomes wrong. The id still says FOUR because there were four when it was written, and an id does not move -- a citation that changes is a citation that breaks. The TITLE dropped the number on the same day rather than being corrected to five, so it can never go stale again. Read the count off the list, not off the name.

AND ACROSS ALL FOUR: LATER DECISIONS AND FACTS OVERRIDE EARLIER ONES. The order above is really a statement about time -- the corpus and the running screens are NOW, the plans are then, the specs are before that. The store sits outside that reading: it is not earlier or later than the corpus, it is about a different subject -- the tool rather than the project.

WHY THE SCREENS SIT AT THE TOP BESIDE THE CORPUS, and it is worth being precise because it is easy to misread: the corpus is the authority on INTENT -- what was decided and why. The screens are the authority on FACT -- what exists, and what their own module headers record themselves as refusing and why. Both are current. Neither settles the other s question. Where a screen does something no decision covers, that is a FACT to be recorded, not a defect to be reverted -- which is the same ruling as "more than the mockup is usually right, because development did not stop when the drawing was finished".

THE CAVEAT THE OWNER GAVE, and it is the one that decides how to read silence: "not everything was added to it from the beginning". THE CORPUS IS AUTHORITATIVE BUT INCOMPLETE. Corpus silence is NOT corpus denial. Where it says nothing, fall to the plans, then the specs, then the first documents -- and what is found there is then ADDED to the corpus, which is how the corpus stops being incomplete.

WHAT THIS IS FOR: a stable base for the next tasks, without coarse contradictions. Not a perfect merge -- the owner said "hope without many coarse contradictions", and a fine disagreement recorded honestly is better than a coarse one resolved by guessing.

HOW TO USE IT WHEN TWO SOURCES CONFLICT:
- A CONTRADICTION IS A FINDING, not a wording problem. Record which source won and why.
- A COARSE contradiction -- the two describe different products -- stops and goes to the owner. A FINE one -- different words for the same thing -- is reconciled and noted.
- Never resolve a conflict by deleting the loser. The superseded statement is how anybody later understands why the winner reads the way it does.

THE MOCKUP IS NOT IN THIS LIST, deliberately. It is the visual authority under RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done, and that rule is untouched. This order governs BEHAVIOUR -- what a screen is for, what it reads, what it refuses.
