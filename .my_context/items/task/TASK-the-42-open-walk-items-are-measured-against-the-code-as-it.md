---
id: TASK-the-42-open-walk-items-are-measured-against-the-code-as-it
type: task
title: the 42 open walk items are measured against the code as it is now, and each one is ruled on
status: active
severity: soft
always: false
summary: Checking the outstanding screen-review notes against the product as it stands, so the ones already overtaken can be closed instead of worked.
summary_of: 66dff13d75ccc93e
acknowledged:
  - task_unverified@35a645251c9a3ef3
scope:
  - src/ui/**
  - .my_context/items/**
tags:
  - v2
  - ui
  - review
  - "plan:walk"
  - "seq:140"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: f8d4831504d30876
plan: walk
seq: "140"
state: done
priority: "1"
---

# the 42 open walk items are measured against the code as it is now, and each one is ruled on

Owner instruction 2026-09-07: review the open walk items and see whether they still hold, whether
they need work, or whether they can simply be superseded.

WHY THIS IS NOT HOUSEKEEPING, and the evidence is from today. The walk items were written during a
screen-by-screen walkthrough against a product that has moved a great deal since. TWO ARE ALREADY
KNOWN STALE: walk seq:16 is `status: deprecated`, and walk seq:20 - "draw the builder once in the
mockup" - had its core instruction KILLED by DEC-the-mockup-is-a-frozen-reference-it-is-read-never-
written, which names it by id. A lane found that only because it read the decision before obeying the
item. THAT IS THE SAME DEFECT CLASS plan:contra was designed against, sitting inside the largest
open block on the board.

SO THE COST OF NOT DOING THIS IS NOT THE BACKLOG - it is that some fraction of 42 items will send a
lane to do work the product has already done or has since ruled against.

HOW TO DIVIDE IT, because 42 items is not the owner’s afternoon. A LANE PRODUCES THE EVIDENCE AND HE
RULES. For each open walk item the lane reports, with citations: what the item says should be true;
what the code does TODAY; whether the item’s premise still holds; and whether any later decision,
rule or item supersedes it - checked, not assumed, because that is exactly what walk seq:20 needed.
Then a verdict PROPOSAL of exactly one of: STANDS (still real work), OVERTAKEN (already done by
something else - name it), SUPERSEDED (a later ruling reversed its premise - name it), or SPLIT (part
stands, part does not).

THE LANE PROPOSES; IT DOES NOT CLOSE. RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done
means no lane may close a walk item. The output is a table the owner reads and rules on in one pass,
which is the difference between an afternoon and a week.

AND IT MUST NOT DELETE HISTORY TO GO GREEN. An item that is OVERTAKEN is superseded WITH a successor
named, never quietly deleted - retirement without a successor is a thing this system does not offer
(retirementEdgeRefusal), and five items in this corpus already violate that. Whatever this produces
must not add a sixth.

MEASURED TODAY: 139 walk items exist, 44 are not done, of which 42 are live (seq:16 deprecated,
seq:21 blocked).
