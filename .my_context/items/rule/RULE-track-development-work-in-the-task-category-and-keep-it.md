---
id: RULE-track-development-work-in-the-task-category-and-keep-it
type: rule
title: Track development work in the task category, and keep it current
status: active
severity: hard
always: true
summary: Every piece of work gets its own tracked entry, updated the moment it moves; progress is reported by reading those entries, never a separate hand-kept note.
summary_of: 2769c37d7d7829a0
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
checksum: 805f996ffa07c8a5
---

# Track development work in the task category, and keep it current

**The `task` category is where development work is tracked. Use it, and keep it
current.**

**Adding.** Every task that will be worked on gets an item in the `task`
category — one item per task, never a list inside one item. A task that exists
only in a plan document or only in this conversation is a task nobody can query
and nobody will find after a compaction.

**Updating.** When a task's `state` or `progress` changes, **update its item in
the same act**, not later. The fields are:

- `state` — `todo`, `doing`, `blocked`, `done`
- `progress` — `0` to `100`
- `last_change` — an ISO-8601 timestamp, **rewritten every time `state` or
  `progress` moves.** A tracker whose timestamps lie is worse than one with no
  timestamps, because it invites the reader to trust an ordering that is not
  real.
- `plan`, `seq`, `source` — where the task comes from, so an item can always be
  traced back to the specification that defines it

**Superseding.** A task that is replaced is superseded by its replacement, both
directions recorded, never deleted and never silently rewritten. A task that is
abandoned is `deprecated` with the reason in the body. **The record of what was
planned and then dropped is worth more than a tidy list.**

**Reporting.** Status and progress are reported by **querying the `task`
category and rendering the result as a table** — never by writing a separate
summary that has to be kept in sync. A hand-written progress note is a second
copy of the truth, and this project has paid four times for two hand-kept
expressions of one thing.

Query it with `mycontext search --type task`, or by tag: `--tag state:blocked`,
`--tag plan:hooks`. Both the tags and the extra fields carry the same values on
purpose — the tags are what you filter on, the fields are what you read.

**The limit that keeps this honest.** The task item tracks **state**. It does
not restate the task's specification: the plan section named in `source` is the
authority, and an item that duplicated it would be a second copy to keep in
sync. If the two ever disagree, the plan wins and the item is wrong.

**Why this category and not `todo`.** A `todo` is an inbox — a low-friction
place for a thought that arises during development so it is not lost. A `task`
is execution tracking. They answer different questions — *"what did I jot
down"* against *"what am I executing, and how far in"* — and putting a project
plan into an inbox is how the inbox becomes noise nobody opens.
