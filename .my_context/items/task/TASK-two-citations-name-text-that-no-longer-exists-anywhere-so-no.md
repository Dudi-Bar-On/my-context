---
id: TASK-two-citations-name-text-that-no-longer-exists-anywhere-so-no
type: task
title: two citations name text that no longer exists anywhere, so no pass can anchor them
status: active
severity: soft
always: false
summary: Two old pointers refer to wording that has since been deleted, so somebody has to work out what was meant before they can be fixed.
summary_of: 61e2a6e3db185f36
scope:
  - .my_context/**
tags:
  - v2
  - corpus
  - citations
  - "plan:walk"
  - "seq:143"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 6924462885da8497
plan: walk
seq: "143"
state: todo
priority: "3"
---

# two citations name text that no longer exists anywhere, so no pass can anchor them

OWNER RULING 2026-09-11: `plan:walk seq:30` closes, and these two come out into their own line
rather than holding it open.

WHAT THEY ARE. Two bare `file:line` pointers that the walk/30 lane deliberately did NOT convert,
and the reason it refused is the whole of why they need a person rather than a pass:

  1. `docs/TUTORIAL-ADVANCED.md:216` — that document is 107 lines today. It was rewritten end to
     end on 2026-09-10 and carries no reference-capture example at all. Line 216 does not exist.

  2. `src/ui/read-model.ts:3054-3057` — at the citing item’s own date this held
     `usage: ledger === null ? …`, checked with `git show`. No sentence resembling the quoted one
     is in that file today, and `docs.js`, named beside it, DOES NOT EXIST.

WHY A PASS CANNOT FIX THEM. An anchor needs a verbatim fragment that is still in the file. Neither
target contains what was quoted, so anchoring either means INVENTING an anchor — which is exactly
the failure `walk/30` was filed about, and exactly the process that let 57 broken corpus citations
accumulate unseen. A plausible wrong pointer sends a reader somewhere real and wrong.

SO THEY STAY BARE AND COUNTABLE. Both remain `citation_form` findings, which is the honest state:
a countable defect rather than an unchecked prose claim. Nothing is suppressed and no marker was
added.

WHAT CLOSING THIS ACTUALLY REQUIRES, and it is not a citation exercise: somebody who knows those
two screens has to work out WHAT WAS MEANT — which sentence, which behaviour — and then either
anchor it to where that now lives, or record that the claim no longer has a referent and drop the
pointer. Reading the citing items’ surrounding paragraphs is the way in.

CONTEXT SO THIS IS NOT RE-DERIVED. `walk/30` turned the corpus walk on by default in the same act:
`npm run verify:citations` now reports 232 corpus citations of which 57 are broken, reported and
never gated. `--no-corpus` turns the walk off. Bare pointers went 12 → 2 and doctor’s
`citation_form` went 8 findings → 2; these two are that 2.
