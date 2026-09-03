---
id: DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling
type: decision
title: Doctor gets a bulk settlement, overturning the no-bulk ruling of 2026-08-31
status: active
severity: soft
always: false
summary: The owner reversed his earlier refusal of a settle-many control in Doctor, because settling seventy findings one at a time is not workable.
summary_of: 86f0f04f85642ebb
scope: []
tags:
  - doctor
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 58223afac2e78dff
---

# Doctor gets a bulk settlement, overturning the no-bulk ruling of 2026-08-31

Owner ruling, 2026-09-03. Asked directly whether he wanted to overturn his own ruling, he answered: "yes".

WHAT IS OVERTURNED

`TASK-doctor-cannot-tell-a-finding-a-command-could-clear-from-one` ruled on 2026-08-31: "No bulk fix all. The findings that dominate the list have no safe mechanical fix, so such a button would either skip 60 of 61 silently or apply anchors measured wrong one time in three." Its Done-when clause reads "no bulk control exists". That clause is now withdrawn. The rest of that task stands and is largely shipped: the remedy union, the no-repair chip, the tally.

WHY IT CHANGED

The 2026-08-31 ruling was made when a finding did not declare what settled it, so a bulk button would have had to guess. Since 2026-09-03 every finding declares a `remedy` with an explicit route, and a check cannot ship without one. A bulk act can now be routed by what each finding SAYS about itself rather than by a guess, which is the condition the original objection was really about.

The second reason is measured. This corpus reports 71 findings, 70 of them routing to `acknowledge`. Settling them one at a time is 70 confirms and 70 single-use nonces. The owner: "for notices that could be many items, we need to have a capability to fix all of them at once using doctor". A gate nobody can afford to pass is not a gate; it is a screen people stop reading, and that is worse than the risk the original ruling was protecting against.

WHAT DOES NOT CHANGE, AND THE ORIGINAL ARGUMENT SURVIVES INSIDE THIS ONE

The objection was never to bulk as such. It was to a button that would "skip 60 of 61 silently". So the shape is inherited from the only sanctioned bulk act in this product, `review promote --all --pack`, and its three rules hold here:

1. A bulk act is licensed by a NAMED, BOUNDED SET the human just chose - never by "everything". `--all needs --pack <name>. There is no unbounded bulk promote here.`
2. Per-item fields are refused inside a bulk act - "a bulk edit wearing a promotion s clothes".
3. The full preview prints BEFORE the gate and regardless of consent, and everything skipped is NAMED.

And the cost argument from `DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing` still binds: a one-token flag that could settle a corpus without a single finding being read is refused. Whatever stands in for consent here is intrinsic to the act rather than bolted onto it.

WHAT IS STILL NOT LICENSED

Acknowledgement remains a MARK and never a filter (`INV-nothing-is-dropped-silently`, `core/acknowledge.ts`): a settled finding stays in the list, stays in the counts, and moves the exit code exactly as before. Bulk changes how many rulings a person can record in one act. It does not change what a ruling means, and it does not make findings disappear.

Auto-repair of findings whose remedy is a human judgement is still refused. `dead_scope` knows the dead glob and never the replacement; the four `summary_*` codes need a written sentence. A command line that cannot be pasted without editing is not a composed command.
