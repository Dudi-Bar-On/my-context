---
id: def-spill
kind: definition
tier: developer
title: a spill is a candidate that did not fit its budget, and is recorded with the reason
term: spill
means: "an item that was an eligible candidate for injection and did not fit its tier’s budget. It is RECORDED with the reason that refused it (`Selection.spilled`), never dropped: every id that was chosen against can be named, together with the budget that did the choosing."
confusedWith: "a SPILLED TOOL RESULT, which is the same word for a different subject — a tool output too large for the transcript, written to a file beside it and reachable from the step that produced it. And an INELIGIBLE item, which never entered the candidate set at all: a spill was eligible, was considered, and lost."
example: the pinned tier oversubscribed by twelve items, one of which spilled 482 times — a number that exists only because spilling is recorded rather than silent.
check: "preventive:src/core/select.ts returns Selection.spilled beside Selection.full, so a candidate that did not fit cannot leave the selector unnamed (INV-nothing-is-dropped-silently)."
---

Two meanings share the word and the project uses both, so the definition names the collision rather
than pretending one of them away. Context separates them: a spill in `select.ts` is about a
BUDGET; a spilled tool result is about a TRANSCRIPT.

What both share is the discipline that makes the word worth keeping — nothing is dropped silently.
A spill is the record of a decision, and the decision is interrogable because the record names its
reason.
