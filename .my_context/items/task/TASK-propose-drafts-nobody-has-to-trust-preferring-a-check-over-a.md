---
id: TASK-propose-drafts-nobody-has-to-trust-preferring-a-check-over-a
type: task
title: propose drafts nobody has to trust, preferring a check over a rule over a lesson
status: active
severity: soft
always: false
summary: Turn what was learned into suggestions that are never in force until approved, favouring something that can be checked over something that must be believed.
summary_of: 99a4ed848059b7ee
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 8fa036b931953e94
plan: loop
seq: "3"
state: todo
priority: "1"
needs: loop/2
---

# propose drafts nobody has to trust, preferring a check over a rule over a lesson

D36c. Plan: docs/superpowers/plans/2026-09-08-self-improvement-proposals.md. Spec sections 4, 5b, 5c, 6, 12, 13.

THE ARTIFACT ORDER IS THE WHOLE POINT AND IT IS EVIDENCE-LED: distilled prose skills measured -2.44pp
while RAW TRAJECTORY RETRIEVAL beat them on every metric, and the one intervention with a large clean
effect compiled corrections into RUNTIME CHECKS THAT MUST PASS (violations 100% to 37.6%). So the
pass asks a second question after "what did we learn": CAN IT BE CHECKED. Check, then rule, then
lesson. LESSON is unchanged as a category; it stops being the default.

AND APPROVING A CHECK MEANS SOMETHING SAFER THAN APPROVING A LESSON: it creates WORK, not law. A
wrong check is found the moment somebody writes it. A wrong lesson sits there being read.

FIVE TASKS: a fourth origin that cannot produce a non-draft and cannot edit; drafts in the gitignored
region, because .my_context/ is committed and an agent-invented draft would otherwise become a TEAM
artefact on the next clone; near-duplicate suppression BEFORE the model reads anything; the prompt;
and the wiring, with recurrence marking a proposal confirmed or unconfirmed.

THE PROMPT IS THE MOST IMPORTANT FILE IN THE CHANGE and the one most likely to ship untested. Its
tests assert all FIVE anti-learning rules and that the sentence which trips the provider content
filter - surfaced upstream as a BILLING error - never appears.
