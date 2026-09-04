---
id: TASK-the-mockup-gives-a-true-conclusion-a-false-reason-a
type: task
title: "the mockup gives a TRUE conclusion a FALSE reason: a similarity metric does exist now"
status: active
severity: soft
always: false
summary: A design note gives a correct decision a reason that is no longer true, and the honest reason would be the stronger one.
summary_of: 7b98b17267d69940
scope: []
tags:
  - "plan:ui2"
  - "seq:5r"
  - v2
  - ui
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 2005648ee1935a59
state: todo
plan: ui2
seq: 5r
needs: port/95
---

# the mockup gives a TRUE conclusion a FALSE reason: a similarity metric does exist now

Found 2026-08-24 while settling plan:ui2 seq:5q, and it survives that ruling rather than being closed by it.

The mockup's Capture section says, in `cap.nosim`:

    No similarity or ranking is shown, because NO SIMILARITY METRIC EXISTS IN
    THIS PRODUCT - and inventing one here is how a mockup starts lying.

The CONCLUSION is now owner-ruled and stands: the screen shows a scope match and never a score (DEC-the-capture-screen-shows-a-scope-match-and-never-a-score).

THE REASON IS FALSE. `overlapScore` exists, behind `POST /api/overlap`, built and tested by ui2 Task 5. `capture-model.ts` says so in its own header - "A similarity metric DOES exist in src/ui/ now". So the design of record states as its justification a fact the code contradicts, which is precisely the failure its own final clause names.

WHAT THE SENTENCE SHOULD SAY INSTEAD: a metric exists and is deliberately not rendered, because it has never been validated against a person's judgement of whether two items are the same rule - and an unvalidated order shown at capture time invites a trust it has not earned. That is a stronger sentence than the one it replaces, because it survives the metric existing.

UNBLOCKED 2026-08-28 — plan:port seq:95 has landed, and this line is corrected rather than deleted because it recorded a real constraint while it held. The `needs` field now carries the reference, so the state is computed rather than read out of prose. Was: BLOCKED BY plan:port seq:95 - the mockup is the design of record and is frozen until the tree-parity inventory is reviewed. `strings-parity` compares the key sets in both directions, so the English and Hebrew tables move in the same commit as the mockup.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND ITS BLOCKER IS STALE. This is a real unblocking, not a restatement.

It is marked BLOCKED BY plan:port seq:95 -- "the mockup is the design of record and is frozen until the tree-parity inventory is reviewed". THE INVENTORY WAS BUILT AND REVIEWED WITH THE OWNER, screen by screen, 2026-08-24 and 2026-08-25, and the owner has since authorised mockup edits directly ("give the mockup a data-t and ship it", 2026-08-25). The freeze is over.

So the sentence can be fixed. What it should say is already written in this task and is the stronger sentence: a metric exists and is deliberately not rendered, because it has never been validated against a person s judgement of whether two items are the same rule.

IT JOINS THE ONE MOCKUP SESSION -- the owner s file, the owner s edit, done in one sitting with plan:walk seq:20, 13, 14, 25, 19, 1h, 3, 6 and plan:screens seq:1s-b, 1s-c, 10s. The session was reported to the owner as SIX items; the reconciliation has found it is FOURTEEN.
