---
id: TASK-two-plan-sentences-to-correct-once-batch-10-lands
type: task
title: two plan sentences to correct once batch 10 lands
status: active
severity: soft
always: false
summary: "Two sentences in the plans are wrong: one about what can be recovered afterwards, and one about what a file actually uses."
summary_of: a62c297b99c764b2
scope: []
tags:
  - "plan:rulings"
  - "seq:33d"
  - "state:todo"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: d0957faf910f3cf7
plan: rulings
seq: 33d
state: todo
priority: "2"
---

# two plan sentences to correct once batch 10 lands

Both are one-line prose corrections held back only because agents are editing the same documents right now; fixing them mid-batch would conflict for no gain.

1. export plan, section 0 item 7: 'Prior content is then recoverable from the log.' It is not. An update mutation record carries the NAMES of the fields that moved and never their values, so nothing under .audit/ can reconstruct a replaced body. The sentence should say 'from git'. Found by the import.ts agent, which refused to write the plan's own test for it and substituted the assertion the code can actually support - kind, instant, fields, origin - with the correction in the test comment.

2. web-ui-2 plan, design decision 3 near line 293: still claims revision-view.ts value-imports REVISION_FIELDS. It does not; it imports changedFields. The citation sweep corrected the Files bullet and missed this one, and the Task 2 agent left it alone rather than edit prose outside its task - which was right.

The second is also a data point about the sweep: it corrected 55 claims and this one survived, so the sweep's coverage is very good and not total.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is now UNBLOCKED and trivially small. Its only reason for waiting was that "agents are editing the same documents right now; fixing them mid-batch would conflict for no gain". No agent wave is running. Two one-line prose corrections. Do them with the six.

IT IS ONE OF SIX TASKS ABOUT ONE GATE, and they have never been read together: plan:rulings seq:33c (thirty bare citations inside fenced code blocks, nearly all stale), seq:33d (two plan sentences), seq:38 (a plan that changes a command breaks the citations in its own survey table), seq:47 (no answer for .html, and six stale source citations), seq:48 (verify:citations does not scan either README), and plan:walk seq:30 (it does not scan the corpus either -- 104 of 109 plan pointers were wrong, corrected 2026-08-25). SIX OPEN TASKS, ONE GATE, THREE KNOWN BLIND SPOTS. That is a scope problem rather than three bugs: settle what the gate scans BY RULE -- every checked text file in the repository, exclusions named and justified -- instead of adding one directory at a time. DISPATCH THE SIX AS ONE PIECE OF WORK.
