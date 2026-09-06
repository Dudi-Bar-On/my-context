---
id: TASK-the-capture-hints-carry-the-category-definition-generated
type: task
title: the capture hints carry the category definition, generated into all twenty-nine
status: active
severity: soft
always: false
summary: Typing a capture shortcut in the terminal now says what that kind of item is, not just how long it should be.
summary_of: cef8e1ce98b4a41e
scope:
  - src/plugin/commands.ts
  - commands/**
tags:
  - v2
  - slash
  - help
  - "plan:library"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: f3f06622825d46d9
plan: library
seq: "8"
state: done
priority: "2"
verified_on: 2026-09-07
---

# the capture hints carry the category definition, generated into all twenty-nine

Owner ruling 2026-09-07 - D24 half two, the half deliberately left unbuilt because it writes into
committed files and was therefore his copy to approve.

RULED: generate the category definition INTO the hint.

    [the constraint in one sentence - Non-negotiable limit: budget, stack, regulation, SLA]

WHY IT MATTERS EVEN THOUGH HALF ONE SHIPPED. Half one put the definition on the help card. But the
hint is what Claude Code shows INLINE while someone types /mycontext:add-constraint in a terminal,
where the card is not visible and the reader is mid-thought. That is the moment the answer is
needed, and it was the moment that had nothing.

GENERATED, NEVER TYPED, and this is the whole discipline: the definitions already live in
src/core/categories.ts, and src/plugin/commands.ts already writes these 29 files. Nothing is
authored - 29 hand-written sentences would be the drift this project measures in days, and would
go stale the first time a category description changed.

TWO THINGS TO GET RIGHT RATHER THAN ASSUME. A hint is shown inline in a prompt, so LENGTH IS A REAL
CONSTRAINT - measure what the longest composed hint becomes and say whether it is still usable, and
if some description is too long, the rule for shortening it must be stated rather than applied case
by case. And the 29 files are COMMITTED and generated: regenerate them with the generator, verify
the diff is only the hint line, and check whether any test holds the old text.

THE LIST-* FILES ARE NOT IN SCOPE. Their hints are flag lists mirroring the CLI and are already
accurate.
