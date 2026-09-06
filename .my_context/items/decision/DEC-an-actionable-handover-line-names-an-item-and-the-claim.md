---
id: DEC-an-actionable-handover-line-names-an-item-and-the-claim
type: decision
title: an actionable handover line names an item, and the claim lives in the item
status: active
severity: soft
always: false
summary: Notes handed between sessions point at the record instead of restating it, so a correction happens once.
summary_of: 833efce243d4bb5a
scope:
  - reports/V2-HANDOVER.md
tags:
  - v2
  - handover
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 34d24887b117b9d9
---

# an actionable handover line names an item, and the claim lives in the item

Owner ruling 2026-09-06 (plan D23), adopting D19 recommendation as a CONVENTION and declining the
check that D19 itself recommended against.

THE RULE. A handover line that asks for ACTION names a lane or an item, and the claim itself lives
in that item. An orienting line - what happened, where things stand - needs no pointer.

THE EVIDENCE IT RESTS ON, both measured. The instruction to widen isServableDocPath was carried SIX
times across six compactions and was impossible, because SKIP_DIRS contains the corpus directory.
And a severity-hard requirement read as contradicting the product for days while the ruling that
settled it sat in the handover FIVE times and in no item - so every reader who consulted the corpus
instead of the handover re-found the same contradiction.

WHY NO CHECK, which is D19 own reasoning and is adopted with it: deciding what "actionable" means
would be wrong often, and its findings could be cleared only by editing the record of a past
session. Wrong often plus unclearable is a gate people route around, and a gate routed around is
worse than a convention followed.

WHAT MAKES IT AFFORDABLE: 117 distinct pointers already, zero dangling. The handover largely does
this; the convention describes the habit rather than asking for a new one.

AND THE OTHER SIDE IS ALREADY GATED. check:handover fails on a pointer that resolves to nothing, and
reports an instruction carried into three or more blocks with its work still open. A line that names
an item cannot rot silently.
