---
id: STD-a-task-body-says-what-to-implement-and-how-never-what-state
type: standard
title: A task body says what to implement and how, never what state the task is in
status: active
severity: soft
always: false
summary: A task records its state in the state field; its body is the instructions for doing the work, and the two must not both claim to say where the task stands.
summary_of: b295a3154f2a54bb
scope: []
tags:
  - corpus
  - tasks
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 16e531f59ca0c74d
---

# A task body says what to implement and how, never what state the task is in

Owner ruling, 2026-09-04, in his own words: "body should not contain state like BLOCKED - for this purpose we use a state field not the body, that should instruct what and how the task would be implemented. The fix is editing / rewriting the body, it should be compatible with it is summary."

THE RULE

A task item carries its state in the `state` FIELD - `todo`, `doing`, `blocked`, `done`. Never in its prose.

The body says what the work IS and HOW to do it. It is instructions for whoever picks the task up, not a status log.

And the body must be compatible with the summary. A summary describing a defect in the present tense, over a body recording a repair that landed, is the same defect one level up.

WHY, AND IT IS THE PROJECT SIGNATURE DEFECT

A state written in prose is a SECOND COPY of a fact the field already holds, and two copies of one fact disagree the moment either moves alone. This project has paid for that shape repeatedly - a hand-kept list beside a derived one, a count in a README beside the program that computes it, a tag beside the field it is projected from.

Found this way on 2026-09-04. `TASK-hooks-task-16` shouted BLOCKED in its body while its field read `todo`; the blocker had cleared and nobody had gone back to the prose. A doctor check caught the disagreement, and the check was right - but only because the two happened to be visible in one file. Nothing would have caught it if the stale claim had lived in a plan document instead.

WHAT THIS RULES OUT

Writing DONE, BLOCKED, RESOLVED, FIXED or CLOSED into a task body as a claim about that task. Recording progress as prose that has to be kept in step by hand.

WHAT IT DOES NOT RULE OUT

History, said as history. "Blocked until 2026-08-22, when the measurement was taken" is a dated record of something that happened, and it is worth keeping - the reasoning that made a decision obvious at the time is the first thing lost. What is refused is the PRESENT-TENSE claim, which competes with the field.

Nor does it touch other categories. A `known_issue` whose body says RESOLVED is a different question, answered by `status`, and a decision that records what was rejected is doing exactly its job.
