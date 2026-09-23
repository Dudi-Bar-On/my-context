---
id: TASK-the-write-must-be-in-contradiction-scope-and-governing-gated-2
type: task
title: "the write must be in contradiction scope and governing (gated, src/core/mutate.ts:1026), and the…"
status: active
severity: soft
always: false
summary: "the write must be in contradiction scope and governing (gated, src/core/mutate.ts:1026), and the id named by --supersedes must have actually been raised as a candidate (settled.some((c) => c.id === draft.supersedes), src/core/mutate.ts:1213 and…"
summary_of: fe007af1e17499d6
scope:
  - src/core/mutate.ts
tags:
  - review-pass
  - "proposer:deterministic"
  - unconfirmed
  - "rec:promote"
  - "state:done"
origin: review
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 92066161bab12602
state: done
---

# the write must be in contradiction scope and governing (gated, src/core/mutate.ts:1026), and the…

It makes a whole claim about src/core/mutate.ts, which is in the repository now. It rests on one session, but approving this creates work to BUILD rather than a law to obey — a check that turns out wrong is found by whoever writes it.
Decided from — subject: file src/core/mutate.ts (present); claim: whole; recurrence: one session only; evidence: 1 record(s).
--- the recommendation ends here; the brief as it was recorded follows, unchanged ---
A draft from the self-improvement pass. It governs nothing and is not committed.
Written by the DETERMINISTIC proposer, which selects a sentence from a transcript and cannot compose one. That is why it authors a task and nothing else: the sentence below is quoted, so it is offered as work to look at rather than as law.
Proposed as a task to BUILD a check rather than as a rule to obey, because it can be checked: the observation describes a gate. Approving this creates work, not law: a check that is wrong is found by whoever writes it.
It is about src/core/mutate.ts, which the evidence names directly.
Seen in ONE session only, so it is UNCONFIRMED. Steps inside a single session are causally correlated and cannot confirm each other; a second, independent session is what would make this more than one observation.
Evidence: agent-a0280a523fd5933c2.jsonl record 152.

What was observed, quoted as evidence rather than as the content of this proposal:
"7. 03-creation-and-gates.md:312–315 — "It also fires as the direct answer to the contradiction gate's --supersedes flag on add/edit — the same mechanism" — the command does not fire; createItem/updateItem call the shared supersedeItem function, and only under two conditions the chapter does not state: the write must be in contradiction scope and governing (gated, src/core/mutate.ts:1026), and…"
