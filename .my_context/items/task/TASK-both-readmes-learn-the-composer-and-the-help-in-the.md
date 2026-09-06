---
id: TASK-both-readmes-learn-the-composer-and-the-help-in-the
type: task
title: both READMEs learn the composer and the help, in the repository and in the corpus at once
status: active
severity: soft
always: false
summary: The project description gains the two screens that were built and proven, in both languages, everywhere it lives.
summary_of: b0d7bdc71d152948
scope:
  - README.md
  - docs/README.he.md
  - test/docs/counts.test.ts
tags:
  - v2
  - docs
  - readme
  - "plan:docsys"
  - "seq:11"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 59be6b8fb056f9d0
plan: docsys
seq: "11"
state: todo
priority: "3"
needs: builder/11,library/6
---

# both READMEs learn the composer and the help, in the repository and in the corpus at once

Owner ruling 2026-09-06 (plan D28), dispatched only AFTER D12 (`builder/11`) and D27 (`library/6`)
have SUCCEEDED - not merely landed.

WHY THAT ORDER IS THE POINT AND NOT A COURTESY. A README describes what the product does. D12 and
D27 are the tasks that establish whether the Composer and the help actually DO it - D12 by
executing every command and checking the result, D27 by comparing every claim on the help screen
against the derivation it came from. Documenting either surface before those pass would be writing
down a belief. His words: this one is about "the composer and the help we implemented and tested
very well (after success of D27 and D12)".

SO THE FIRST ACT OF THIS TASK IS TO READ THOSE TWO RESULTS, and if either found defects that were
not fixed, this task STOPS and says so rather than describing the surface as though they had
passed.

FOUR FILES MOVE TOGETHER OR THE TASK IS NOT DONE. The owner asked for the corpus AND the repository
"at the same time", and the reason is measured history: `README.md` and `docs/README.he.md` drifted
apart on 2026-09-06 when one half of a citation fix was pushed without the other, and closing that
drift cost a day.

  README.md              the repository English
  docs/README.he.md      the repository Hebrew
  their corpus copies    brought in by `docsys/4`; `watchedDocs` is what makes them viewable

A change to one half that leaves the other stale is the defect this project measures in days, and
the Hebrew is the half that goes stale, every time, because it is the one nobody reads while
working.

WHAT GOES IN, and only this - more README work is coming and is NOT this task:
  THE COMPOSER: what it is, that it composes a command from selections, what Copy and Execute mean
    and how they differ, the pickers that derive their own lists, and that an id in a result opens
    the item pane. Whatever D12 settles about Run belongs here too.
  THE HELP: that the Library explains every command, switch, parameter and slash command with
    worked examples, derived from the registry at request time rather than written down.

EVERY NUMBER IS DERIVED OR IT IS WRONG. The catalogue said "38 commands" and was right on
2026-08-24; today it is 44. `test/docs/counts.test.ts` already holds the README figures against the
product and is the mechanism to extend, never a place to hand-edit agreement into. Same for
`gen-doc-examples.ts`, which RUNS the commands it documents and pastes their true output - any
example added here goes through it rather than being typed.

AND THE HEBREW IS A TRANSLATION OF WHAT SHIPPED, not a shorter version of it. The two files have
diverged before by abridgement rather than by error.
