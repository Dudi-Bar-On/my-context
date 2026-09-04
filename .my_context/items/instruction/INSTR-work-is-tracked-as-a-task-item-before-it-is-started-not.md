---
id: INSTR-work-is-tracked-as-a-task-item-before-it-is-started-not
type: instruction
title: work is tracked as a task item before it is started, not after it is finished
status: active
severity: hard
always: true
summary: No subagent is dispatched and no non-trivial work is begun until a task item exists for it, and the item is moved through its states by the product.
summary_of: 6cd00dbe465e5154
scope: []
tags:
  - v2
  - process
  - tracking
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 5bd9a8f89cd9ba06
---

# work is tracked as a task item before it is started, not after it is finished

Owner instruction, 2026-09-04. He asked whether all the work had been generated as tasks in
my_context and the answer was no, so he asked for a mechanism that enforces it rather than
another intention.

A task item exists BEFORE work starts. The lane that does the work is told the item id, moves it
to doing when it begins, and to done with verified_on when it is verified, through mycontext edit
and never by editing a file. Work done directly rather than by a lane is held to the same rule
whenever it is more than a single command, and the test for more is whether a reader next week
would want to know it happened.

What went wrong, so the reason is not lost. On the same day the A B C board was standardised into
twelve corpus items, so that work would be treated as ordinary task items, three lanes were
dispatched on work that never became an item, one of them still running when he asked. The
untracked work had not been eliminated, it had moved out of a report and into a dispatch queue.

The habit that caused it is worth naming because it is easy to fall back into: an item was filed
whenever something was FOUND and skipped whenever something was DONE immediately. That is
backwards. A finding is a guess about future work; a thing that shipped is a fact, and the corpus
is meant to record what was built and not only what is left.

An intention was not enough here, and the evidence is that this project already carried a ruling
to standardise the board and the ruling did not prevent any of the three. So the instruction is
accompanied by a mechanism, and where a mechanism refuses, the refusal is the point.

A deliberate exception is allowed and must be STATED rather than silent, in the same shape as the
other audited hatches in this project: a summary left unchanged is declared, a bulk settlement is
consented to by a count, and a skipped item is named. An exception nobody can see later is the
thing this instruction exists to stop.

Plans are not yet part of this. The plan category holds no items and every plan name on a task is
free text that resolves to nothing, which is parked pending the spec, plan and task design. Tasks
are the unit of tracking until that lands, and then this instruction extends to plans.
