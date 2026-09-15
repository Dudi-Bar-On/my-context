---
id: TASK-the-review-queue-explains-a-proposal-at-length-and-never
type: task
title: the review queue explains a proposal at length and never says, briefly, what to do about it
status: active
severity: soft
always: false
summary: Every proposal makes you read the full reasoning before you can decide anything, with no short answer about what to do or why.
summary_of: 4be2958562da35d6
scope:
  - src/review/**
  - src/ui/public/screens/**
  - src/ui/public/strings/**
tags:
  - v2
  - ui
  - review
  - "plan:review"
  - "seq:7"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 69598164464b0737
plan: review
seq: "7"
state: todo
priority: "2"
---

# the review queue explains a proposal at length and never says, briefly, what to do about it

OWNER REQUEST 2026-09-15, in his words: "i looked at the review queue and it looks fine but the
“Why this was proposed” section is not short and could be tedious so a helppfull addition would be
a short recommendation including short and simple explanation of “why you are recommending this”."

WHAT HE IS LOOKING AT. `work.brief` renders the dispatch brief the review pass recorded when it
captured the draft. It is the reasoning in full, and it is the right thing to keep — but it is what
he has to read before he can decide anything, and there are many drafts.

REPRODUCED on a draft standing in his queue today. The summary alone reads:
  "58% of its rows (157/269) were written by test/rules/lane-still-gets-the-no-git-rule.test.ts
   into the owner’s live workspace, corrupting the one count spec §8.2 defines; and the
   session-start door has never once delivered successfully — zero rows…"
That is one sentence, already truncated, and it is the SHORT field. It tells him what was found and
never what to do about it.

WHAT IS BEING ASKED FOR, and it is two things, not one:
  1. A SHORT RECOMMENDATION — what he should DO with this draft. Promote it, decline it, or that it
     needs him because it cannot be decided from the corpus.
  2. A SHORT, SIMPLE WHY — one or two plain sentences for the recommendation, not the evidence.
Both sit ABOVE the full brief, which stays exactly where it is and is not shortened. A reader who
wants the reasoning must still be able to get all of it, unedited.

THE CONSTRAINT THAT DECIDES THE DESIGN, AND IT IS LOAD-BEARING. `work.brief` ends with the sentence
"Nothing here is composed now." The brief is written AT CAPTURE, by the pass that read the session,
and the screen only renders it. THE RECOMMENDATION MUST BE WRITTEN THE SAME WAY — at capture, by
the pass, recorded on the draft. It must not be composed when he opens the queue.

That is not ceremony. A recommendation composed at read time would be a fresh model answer about a
draft whose session is long gone, presented in the same place as something that was recorded with
the evidence in hand. The reader could not tell the two apart, and the screen would be asserting
something nothing measured. It would also be a derivation the reader never asked for, which is the
line `NOGOAL-not-a-claude-mem-replacement` draws.

ABSENT IS ABSENT, AND THERE IS ALREADY A PRECEDENT TO COPY. `work.briefNone` exists for a draft
with no recorded brief and says so plainly rather than inventing one. A draft captured before this
ships has NO recommendation, and the screen must say that — not fall back to a guess, and not draw
an empty box. Every draft now in his queue is in exactly that state.

THE PASS CAN NOW DO THIS AND COULD NOT BEFORE. `review.model` is configured and a real pass calls
it; deterministic proposals also exist and carry `proposer:deterministic`. A DETERMINISTIC proposal
may be able to state its recommendation without a model at all, from the rule that fired — that is
the cheaper half and should be measured first.

WHAT WOULD MAKE THIS WORSE THAN NOTHING. A recommendation that is always "promote" is a button with
a sentence next to it. If the pass cannot tell promote from decline for a class of draft, it should
record that it could not, and the screen should show that — an honest "this one needs you" is worth
more than a confident default. Measure the spread across real drafts before shipping: if the
recommendation is the same value on nearly all of them, it carries no information and the item is
not closed.
