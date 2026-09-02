---
id: REQ-every-screen-has-a-task-that-implements-it-until-the-mockup
type: requirement
title: every screen has a task that implements it, until the mockup is no longer needed
status: active
severity: hard
always: false
summary: Every screen has a written record of what it is and what it must do, so the design drawing stops being the only place that says so.
summary_of: b49082f75fe0bb4a
scope: []
tags:
  - v2
  - ui
  - owner-requirement
  - tree-parity
  - mockup
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 834d1da03f3d9ea5
---

# every screen has a task that implements it, until the mockup is no longer needed

OWNER REQUIREMENT, stated 2026-08-25 as the goal the screen walk was FOR: "our goal at the end of the walk is to itterate all the app menue and screens and verify they have a task that implement them so the link to the mockup will become weaken till none", and "of course no unsolved gaps to the mockup".

THIS IS A LARGER GOAL THAN THE WALK WAS BEING RUN AGAINST. The walk was producing a fix-list. What it is FOR is different and better: every one of the twenty-one rail items ends with a TASK that says what that screen is and what it must do, and every divergence from the design of record is either closed or ruled. When that holds, the mockup has been read out into the corpus and stops being the thing anybody has to open.

WHY THAT MATTERS, and it is not tidiness. Today the specification is an HTML file that has to be opened, looked at, and interpreted by a person or an agent every time a question is asked. Every gate in this project exists to compare something against it, and every one of them has been found blind in some direction -- a sorted set, a byte-identical block in the wrong order, a count of places rather than damage. A specification carried as TASKS is queryable, reviewable, and cannot be blind: it says what must be true in words, and the words are checkable by reading rather than by a regex over markup.

WHAT IT DOES NOT MEAN: the mockup is not deleted and RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done is not softened. The link weakens because the tasks come to carry what the mockup carries, not because anyone stops matching it. Until a screen s task says what its screen must do, the mockup is still the only thing that does.

DONE WHEN, and all three:
1. Every rail item has at least one open or closed task that IMPLEMENTS it -- not a task about one of its defects, a task that says what the screen is.
2. Every tree-parity divergence on every screen is closed, or ruled, or recorded as a data difference with the fixture task that would settle it.
3. No screen depends on the mockup for a fact that is written down nowhere else.
