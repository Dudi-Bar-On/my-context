---
id: TASK-ready-schedules-work-and-never-surfaces-a-decision-so-every
type: task
title: ready schedules work and never surfaces a decision, so every question reaches the owner by my remembering
status: active
severity: soft
always: false
summary: Questions waiting on you now appear in `mycontext ready`, where you already look to see what is next, instead of depending on somebody remembering to raise them.
summary_of: 2170fe7b27c1a044
summary_was:
  - 2026-09-11 Questions waiting on you appear where you look to see what is next, instead of depending on somebody remembering to raise them.
scope:
  - src/cli/commands/ready.ts
  - src/core/questions.ts
  - src/core/command-flags.ts
  - src/doctor/checks.ts
  - test/cli/ready-questions.test.ts
tags:
  - v2
  - cli
  - process
  - "plan:governance"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: e66ab54e64d89683
plan: governance
seq: "9"
state: done
priority: "1"
---

# ready schedules work and never surfaces a decision, so every question reaches the owner by my remembering

Found 2026-09-09, and found by the corpus refusing me rather than by anybody looking. Filing
`plan:live seq:23` - a decision awaiting the owner - I put a `plan` extra on an `open_question`,
and the write was refused: "extra field \"plan\" is not declared by \"open_question\", so it would be
stored on an item whose category never promises it and read back by nothing."

THE REFUSAL WAS CORRECT AND IS NOT THE DEFECT. `plan` and `seq` exist so `mycontext ready` can
schedule work. A question is ANSWERED, not scheduled, so the field would have been stored and read
by nothing - which is exactly what the message said. No new category is wanted either: the
vocabulary was complete, and `open_question` is the right shape.

THE DEFECT IT EXPOSED IS THAT NOTHING SURFACES A DECISION.

`mycontext ready` lists ready tasks and names the blocker of every held one. IT NEVER LISTS OPEN
QUESTIONS. So `live/23` now sits in the corpus, blocking `live/22`’s approach, with nothing putting
it in front of the owner. And `blocks` - the field I used instead, which `open_question` DOES
declare - is read by nothing operational: `ready.ts`’s only "blocks" is a local array of output
paragraphs. Measured, not assumed.

SO EVERY DECISION THAT REACHED HIM ON 2026-09-08 AND 09 REACHED HIM BECAUSE I ASKED IN
CONVERSATION. Twelve of them overnight, held in a note I hand-built
(NOTE-decisions-collected-overnight-for-the-owner-to-answer-in-the) precisely because no surface
would have carried them. That note is a workaround wearing the shape of a feature, and it depends
on an assistant remembering across a compaction - which is the one thing this whole product exists
because assistants do not do.

AND IT IS THE SAME DEFECT CLASS AS plan:archive seq:9, WHICH IS THE ARGUMENT FOR FIXING IT HERE.
There, off-by-default was correctly enforced in three places and stated in none, so the item read as
"never built" until somebody traced the callers. A fact that is true and unsurfaced is the recurring
shape in this corpus: a dead disclosure, an unreachable chip, a nickname resolving to no item, a
gate pinning a line that moved. This is that shape applied to the queue itself.

WHAT TO BUILD: `ready` lists OPEN QUESTIONS that stand between the reader and ready work, the same
way it already lists held tasks and names what holds them. A question is not a task and must not be
drawn as one - it has no `seq`, nothing depends on its completion, and it is finished by an ANSWER.

TWO SURFACES TO WEIGH, AND THE SECOND IS THE OWNER’S OWN SUGGESTION:

  1. `mycontext ready`. It is where somebody goes to ask "what now", it already computes held-ness
     from `needs`, and it already refuses to go stale because nobody keeps it by hand. A question
     block beside the held block is a small change.
  2. THE REVIEW QUEUE. He asked whether that surface could carry this, and it is a better fit than
     it first looks: the review queue already exists to hold things a person must LOOK AT and
     decide on, which is what a question is. `ready` answers "what can be worked"; the review queue
     answers "what needs me". A decision belongs in the second.
     MEASURE WHAT IT HOLDS TODAY before choosing - if it is scoped to drafts and promotions, adding
     questions widens its meaning, and a queue that mixes "approve this draft" with "rule on this
     design" may serve neither.

THE HONEST ANSWER MAY BE BOTH, and if so say which is canonical: `ready` naming the count and
pointing at the queue, the queue holding the questions themselves. What must not happen is two
lists that can disagree - this corpus has spent seven items on hand-kept lists that had to agree
with something derived.

ONE THING TO DECIDE RATHER THAN ASSUME: WHICH questions surface. All active `open_question` items,
or only those something depends on? There are seven active today and they are not equally urgent -
one blocks `live/22` right now, others have sat for weeks. A queue that lists all seven every time
trains a reader to skip it, which is how the audit stream earned 5,207 rows nobody read.
