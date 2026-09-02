---
id: TASK-hooks-the-clear-literal-is-unproven-until-task-1-runs
type: task
title: "hooks: the clear literal is unproven until task 1 runs"
status: active
severity: soft
always: false
summary: The code guesses the word the editor uses when a conversation is cleared; the guess is reasonable, but nobody has yet watched it happen.
summary_of: 1fa813d12c0d4c19
scope: []
tags:
  - "plan:hooks"
  - "seq:8p"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: bd968c0655375336
plan: hooks
seq: 8p
state: done
priority: "2"
---

# hooks: the clear literal is unproven until task 1 runs

hooks task 8 shipped the clear branch against source === 'clear' - the only value hooks/io.ts documents and hooks/hooks.json matches. It is correct under three of the four rows of task 1's decision table, and under the fourth (SessionStart never fires on a clear) it is dead code costing one comparison.

Task 1 was never run: it is blocked on the owner in an interactive session, and reports/probes/ does not yet exist. So the literal is reasonable, not proven.

The comment beside const clearing says exactly this, so when the probe finally runs it replaces a literal, not a branch. Close this item by running task 1 and confirming or correcting the value - not by re-reading the code, which cannot answer it.
