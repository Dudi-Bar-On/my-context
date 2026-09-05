---
id: RULE-a-task-that-changes-a-surface-repairs-the-citations-that
type: rule
title: a task that changes a surface repairs the citations that quote it, in its own steps
status: active
severity: soft
always: false
summary: Renaming or changing something breaks the quotations pointing at it, and repairing them belongs in the task that caused it.
summary_of: b7aa75ebd167d949
scope:
  - docs/superpowers/plans/**
  - docs/superpowers/specs/**
tags:
  - v2
  - citations
  - plans
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: ba7d06f25480e6bf
---

# a task that changes a surface repairs the citations that quote it, in its own steps

Filed 2026-09-05 while clearing the citation gate (plan:rulings seq:64). The pattern is recorded
in seq:38, which counted it happening THREE times and predicted it would keep happening; it has
now happened a fourth and fifth time, in the corpus and in the source.

THE PATTERN. A plan orders a rename or a signature change. The implementer lands it. The gate goes
red - and the broken citations are in the PLAN’S OWN survey table, quoting the surface the plan
just changed. export task 15 changed `mycontext init` and broke four, three of them the plan’s own
Verified-facts rows. ui2 task 2 renamed lineDiff and broke four in the plan that ordered the
rename. ui3 task 1 renamed readSegmentFrom and broke three, two in the same document.

WHAT IT COSTS is not the repair, which is cheap. It is that each agent DISCOVERS it as a red gate
rather than reading it as an instruction, and a red gate discovered at the end of a task is
indistinguishable from a red gate somebody else left.

SO: a task that renames a symbol, changes a signature, or moves a surface says in its OWN steps
that it repairs the citations quoting that surface - including the ones in the plan that ordered
it. Not as a cleanup afterwards; as a step of the task, because it is part of landing the change.

HOW TO REPAIR, and the choice is the whole judgement. Re-anchor where the CLAIM still holds and
only the code moved - update the quoted fragment to the current text and let `--fix` refresh the
line. Mark it historical where the prose deliberately quotes what was true before. Correct the
prose where the claim itself has stopped being true. The three are different acts and picking the
wrong one hides a real change behind a green gate.

MEASURED, so the scale is on the record. On 2026-09-05 the gate carried 859 moved and 9 broken
citations across 45 documents - 72% of every citation in the design record pointing at a line that
had moved. `--fix` cleared the 859 mechanically. The 9 broken were all one shape: the claim still
held and the fragment had changed under it, which is the first case above and the most common.

WHAT `--fix` DOES NOT DO, and why this rule cannot be replaced by running it. It refreshes a LINE
hint for a fragment it can still find. It cannot know that a fragment changed, that a claim stopped
being true, or that a sentence meant to quote the past. Those are the three the author has to make,
and they are exactly the ones a task can foresee at the moment it changes the surface.
