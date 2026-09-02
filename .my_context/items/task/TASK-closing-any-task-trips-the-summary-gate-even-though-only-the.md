---
id: TASK-closing-any-task-trips-the-summary-gate-even-though-only-the
type: task
title: Closing any task trips the summary gate even though only the workflow field state changed, training reflexive use of --summary-unchanged
status: active
severity: soft
always: false
summary: A warning meant for real rewrites now fires on every finished task, so people wave it away by habit, and it stops protecting the cases it was built for.
summary_of: 5d163348367b9b3f
scope: []
tags:
  - summary
  - summary-gate
  - edit
  - workflow
  - owner-ruling-needed
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: 34df905b5f87cb02
state: todo
---

# Closing any task trips the summary gate even though only the workflow field state changed, training reflexive use of --summary-unchanged

`mycontext edit <id> --extra state=done` refuses with: "this edit changes what <id> SAYS,
so the summary written against the old text would no longer describe it… Nothing was
changed." — even though only the workflow field `state` moved and no body text changed.
Three separate lanes hit this last night (2026-08-26/27) and every one resolved it with
`--summary-unchanged`.

Why it matters, and this is the substance of the item: every task closure now requires the
escape hatch, which trains people to reach for it by habit. A hatch used reflexively stops
being the deliberate act it was designed to be, and then it no longer protects anything —
including the cases it exists for, where a body really did change.

The gate is firing where it should not: `state` is a field, so the basis moves by the gate's
current rule, but recording that work is finished is not a claim about what the item SAYS.

This needs an owner ruling, not an implementation: does a workflow field (`state`,
`progress`, `last_change`) belong in the summary basis at all, or should the basis exclude
workflow fields the way it already excludes tags?

On the source of the gate: I searched the corpus for the decision or instruction that
established the summary-basis gate itself (the refusal on `edit` when a field changes) and
did not find one. The two items tagged `summary` are
STD-a-summary-is-one-plain-sentence-for-someone-who-does-not (the owner ruling of
2026-08-31 on what a summary must say and why it must not embed properties like state) and
DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing (a 2026-09-01 decision about
a different edge case — reaffirming an already-stale summary — that documents the gate's
existence but did not create it). Neither is the origin of the gate mechanism itself; I am
not inventing a link to one that fired at the wrong scope, and this task should say so
rather than guess.
