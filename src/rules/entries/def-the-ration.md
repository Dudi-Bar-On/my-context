---
id: def-the-ration
kind: definition
tier: developer
title: the ration bounds how much the self-improvement pass may put in front of a person
term: the ration
means: "the cap on how much the self-improvement pass may put in front of a person: `review.maxProposalsPerPass` bounds ONE pass, and `review.queueCeiling` bounds the QUEUE — past the ceiling a pass writes nothing at all and says so, while capture continues and proposals wait."
confusedWith: "an injection budget. A budget bounds what is DELIVERED into a context window and spills the rest; the ration bounds what is WRITTEN for a human to review, and HOLDS the rest. And it is not a throttle for cost: it exists because oversight has a capacity, and past it reviewer reliability decays so that MORE escalation makes the system LESS safe."
example: `queueCeiling` ships at 15 — `maxProposalsPerPass` 5 × `maxFiresPerSession` 3, one session at full ration — and `maxProposalsPerPass` itself ships at 0, so the ration is set to nothing until the owner raises it.
check: "preventive:test/review/ration.test.ts asserts a pass yielding more than maxProposalsPerPass creates only that many and reports the remainder as HELD rather than dropped, and that a queue at queueCeiling creates nothing."
---

The owner chose an age-coloured count for the queue, and the ration was added beside it rather than
instead of it, because the two do different work: **the colour tells him the queue is ageing; the
ration stops it becoming unworkable.**

The word is worth defining because it sounds like scarcity and is not. Nothing is lost at the
ration — held is not dropped, and every observation is still screened, classified and noted as a
sighting whether or not a proposal comes out of it.
