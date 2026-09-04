---
id: TASK-a-plan-that-changes-a-command-breaks-the-citations-in-its
type: task
title: a plan that changes a command breaks the citations in its own survey table
status: active
severity: soft
always: false
summary: Changing something a plan quotes breaks the plan's own quotations, and people keep discovering that as a failed check instead of being warned.
summary_of: db924d311e5d8474
scope: []
tags:
  - "plan:rulings"
  - "seq:38"
  - "state:todo"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 76e1d388f695d7fe
plan: rulings
seq: "38"
state: todo
priority: "2"
---

# a plan that changes a command breaks the citations in its own survey table

Third time this pattern has cost an agent time, so it belongs on the board rather than in three separate commit messages.

export task 15 changed mycontext init. Four citations went BROKEN and verify:citations exited 1 - three of them the plan's OWN 'Verified facts' rows, quoting the pre-change init, and one in the scope-decisions spec. Nothing in the plan warns that landing task 15 breaks the plan's own survey.

The same shape hit ui2 task 2 (renaming lineDiff broke four citations in the plan that ordered the rename) and ui3 task 1 (renaming readSegmentFrom broke three, two of them in the same document).

The fix each time is correct and cheap: re-anchor where the claim still holds, historical-citation where the prose deliberately quotes what was true before. The cost is that each agent discovers it as a red gate rather than reading it as an instruction.

Worth one line in the writing-plans guidance: a task that renames or changes a surface must expect to repair the citations in its own plan, and should say so in its own steps.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. Its own framing is the reason it belongs with the other five -- "third time this pattern has cost an agent time, so it belongs on the board rather than in three separate commit messages". It has now cost time a fourth time, in the corpus.

IT IS ONE OF SIX TASKS ABOUT ONE GATE, and they have never been read together: plan:rulings seq:33c (thirty bare citations inside fenced code blocks, nearly all stale), seq:33d (two plan sentences), seq:38 (a plan that changes a command breaks the citations in its own survey table), seq:47 (no answer for .html, and six stale source citations), seq:48 (verify:citations does not scan either README), and plan:walk seq:30 (it does not scan the corpus either -- 104 of 109 plan pointers were wrong, corrected 2026-08-25). SIX OPEN TASKS, ONE GATE, THREE KNOWN BLIND SPOTS. That is a scope problem rather than three bugs: settle what the gate scans BY RULE -- every checked text file in the repository, exclusions named and justified -- instead of adding one directory at a time. DISPATCH THE SIX AS ONE PIECE OF WORK.
