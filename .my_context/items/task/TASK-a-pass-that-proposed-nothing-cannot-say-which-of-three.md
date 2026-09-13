---
id: TASK-a-pass-that-proposed-nothing-cannot-say-which-of-three
type: task
title: a pass that proposed nothing cannot say which of three things happened
status: active
severity: soft
always: false
summary: When the loop asks a model and gets no suggestion back, nothing in the record says whether the model declined, answered unreadably, or was never reached.
summary_of: 8a724f20f54b50e7
scope:
  - src/review/pass.ts
  - src/review/model.ts
tags:
  - v2
  - loop
  - "plan:loop"
  - "seq:7"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/zero.md"
source_anchor: null
source_checksum: 7e1b1541761da6bf
valid_from: 2026-09-13
valid_until: null
checksum: 6fd202cc922adb6d
plan: loop
seq: "7"
state: done
priority: "1"
---

# a pass that proposed nothing cannot say which of three things happened

> FOUND 2026-09-13 by running the loop for real, twice, against Opus, and reading what the report kept.
>
> A pass that reached a model and proposed nothing records `returned: 0` and `rejected: []` — AND NEVER THE REPLY. Three different events produce exactly those two values:
>
>   1. the model returned an empty array - A CONSIDERED REFUSAL, and the prompt's five anti-learning rules working
>   2. the model returned prose the parser never saw as a candidate - AN UNREADABLE ANSWER
>   3. the model returned nothing at all
>
> `why` separates the second from the others ONLY when the parser had a complaint to make; a reply that parses cleanly to something that is not a candidate list leaves `why: null` as well. SO THE THREE ARE THE SAME TWO ZEROS.
>
> WHY THAT MATTERS MORE HERE THAN ALMOST ANYWHERE. This loop's whole purpose is to propose. A loop that proposes nothing is either working exactly as designed or completely broken, AND THE REPORT CANNOT SAY WHICH. The evidence that separates them exists for the length of one function call and is then discarded — `INV-nothing-is-dropped-silently` applied to the one drop that decides whether the subsystem is trusted.
>
> MEASURED BEFORE THE FIX. Two real passes on 2026-09-13 with `claude-opus-5`: 14.7 s over a 8,918-byte prompt, and 16.2 s over a 28,305-byte prompt built from 60 points. Both `ok: true`, all five anti-learning rules delivered, none missing, `rejected: []`, `why: null`, `returned: 0`. A sibling lane's run against Haiku on a smaller prompt returned 2. So THE MORE CAPABLE MODEL PROPOSED LESS, which is either the prompt doing its job or a defect, and nothing in the record could tell the owner which.
>
> WHAT THIS ASKS FOR:
>
> 1. KEEP THE REPLY WHEN, AND ONLY WHEN, NO CANDIDATE CAME OUT OF IT. On both zero paths - the clean empty array and the unparseable one - because they are the two a reader cannot otherwise tell apart. NOT when a candidate was produced: the answer is then visible as the proposal, and keeping the prose as well would put a model's text in every report for no question it answers.
>
> 2. BOUND IT, AND SAY HOW MUCH WAS DROPPED. A bound that hides its own truncation is the defect this product files against other people's code.
>
> 3. IT STAYS ON THE MACHINE. `.my_context/state/` is gitignored, so the reply never leaves. That is a property to state, not to assume.
>
> WHAT THIS IS NOT. It is not a claim that the model is misbehaving. It is a claim that THE PRODUCT CANNOT TELL, and that a subsystem which cannot distinguish its own success from its own failure will be turned off by the first person who doubts it.
