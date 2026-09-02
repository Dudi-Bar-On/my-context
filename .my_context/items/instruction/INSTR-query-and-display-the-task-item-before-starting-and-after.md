---
id: INSTR-query-and-display-the-task-item-before-starting-and-after
type: instruction
title: Query and display the task item before starting and after finishing
status: active
severity: soft
always: true
summary: Look up the work item and show it before starting and again after finishing, read back from storage rather than described from what you wrote.
summary_of: 17abf1be0855f4cb
scope: []
tags:
  - process
  - tasks
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: bf08cbf4df2103c4
---

# Query and display the task item before starting and after finishing

**Query the task item and display it BEFORE starting a task, and again AFTER
finishing it. Both times, to the person you are working with.**

**Before.** Read the item out of the `task` category and show it — its `state`,
`priority`, `plan`, `seq`, `source` and body. Do this before dispatching an
implementer, before writing a line, before extracting a brief. It is how both of
you see the same thing: what this task actually is, where its specification
lives, and what shape it was left in.

**After.** Query it again and show it, with what changed — `state`, `progress`,
`last_change`, and any relation added. Not a sentence claiming it is done: the
item, read back from disk.

**Why the second read is the one that matters.** Displaying what you *wrote*
proves nothing; displaying what the corpus *now holds* proves the write landed
and landed correctly. This project has repeatedly found the two differing — an
edit refused for a reason nobody read, a field set on one surface and not the
other, a checker green because it never ran the file. **A tracker nobody reads
back is a tracker that drifts, and it drifts silently.**

**It catches the specific mistake this project already made.** A task's state
lives in two places on purpose — a **tag**, which is what you filter on, and an
**extra field**, which is what you read. Updating one and not the other leaves
the item internally inconsistent, the counts wrong, and nothing complaining.
Reading the item back after the change is what surfaces it, and that is exactly
how it was caught the first time.

**What to display.** For one task, the item. For several, a table — the columns
that carry state: id, plan, seq, state, progress, priority. Query it; do not
retype it from memory. Per
`STD-v2-0-progress-report-and-the-format-progress-reports-use`, counts are
computed, never remembered.

**The boundary.** This is about the item, not the specification. The task item
tracks state; the plan section named in `source` is the authority. Displaying
the item is not a substitute for reading the plan, and if the two disagree the
plan wins and the item is wrong.
