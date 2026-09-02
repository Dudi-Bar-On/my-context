---
id: RULE-a-task-is-not-done-until-its-state-says-done
type: rule
title: a task is not done until its state says done
status: active
severity: hard
always: false
summary: Mark a piece of work finished the moment it actually is, or the shared list of what is left will quietly mislead everyone who reads it afterwards.
summary_of: f0cbdb2b79ca908b
scope: []
tags:
  - v2
  - process
  - tasks
origin: human
source_file: null
source_anchor: null
source_checksum: e9cd94188019d8af
valid_from: 2026-08-28
valid_until: null
checksum: 5c38ba7599f1a7fa
---

# a task is not done until its state says done

> When the work a task describes lands, move that task to `state: done` in the
> same breath — not at the next report, not at the end of the session.
>
> `mycontext edit <id> --extra state=done`
>
> ## Why this is a rule and not a habit
>
> The corpus is the board. A task whose work shipped but whose state says `todo`
> is a lie the board tells everyone who reads it afterwards, including the next
> session, which has no other way of knowing.
>
> **Measured 2026-08-28**, within an hour of the progress standard being written:
> `plan:live seq:1` was implemented, committed as `a257c31`, and green through
> 192 browser tests. Its state was still `todo`. The first progress table drawn
> under the new standard therefore reported `plan:live` at **0% with three open
> priority-1 tasks** when it was at 20% with two. The table was correct about what
> it read and wrong about the project — which is this repository's most expensive
> recurring shape, arriving in its reporting layer.
>
> The error runs in the FLATTERING-TO-DO direction, which is why it survives:
> finished work reads as outstanding, so the board over-reports what is left and
> under-reports what was done. Nobody investigates a plan that looks behind. They
> investigate one that looks finished and is not, and that is the error this rule
> does not prevent — see below.
>
> ## What "done" means, so the state is worth trusting
>
> `done` means the work landed and its gates passed. Not "the code is written",
> not "the subagent reported DONE": committed, and the checks that cover it green.
> A state that means "probably" is a state nobody can count.
>
> For a UI change, `RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it`
> sets that bar higher, and it is the bar that applies.
>
> ## The half this does not fix
>
> A task marked `done` whose work regressed still says `done`. This rule makes the
> board honest at the moment work lands; nothing here re-checks it later. That is
> what a reconciliation pass before a progress report is for
> (`STD-the-progress-table-has-one-format-and-this-is-it`), and it is why that
> standard requires the pass rather than trusting the states it is about to count.
