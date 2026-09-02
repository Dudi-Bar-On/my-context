---
id: TASK-one-copy-and-execute-control-adopted-by-the-seven-screens
type: task
title: one Copy-and-Execute control, adopted by the seven screens that compose a command
status: active
severity: soft
always: false
summary: One shared button for copying and running a command, so nine hand-written versions do not each get the confirmation wrong.
summary_of: 6447ed9a667abf96
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - screens
  - "plan:execute"
  - "seq:6"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: ecc6e05fbe685ffb
plan: execute
seq: "6"
state: done
priority: "2"
source: owner, 2026-08-26 ruling; plan written 2026-08-27
---

# one Copy-and-Execute control, adopted by the seven screens that compose a command

This item tracks state only. The task itself is Task 6 of docs/superpowers/plans/2026-08-27-execute-a-composed-command.md, which carries the tests, the code and the commit message. The design is docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md — read section 3 AND section 6 together; 6.1 widened 3.2.

MEASURED: nine `navigator.clipboard.writeText` sites across the screens, each with its own button, its own error handling and its own words. Adding Execute nine times would be nine chances to get the confirm wrong, and the confirm IS the security boundary.

TWO OF THE NINE GET NO EXECUTE, and the code says why: `config.js` copies the budgets TEXT and there is no command that edits a budget — `cfg.nocmd` says so in the product's own words — and `coverage.js`'s `EMPTY_COMMAND` composes nothing, the same reason Doctor composes nothing for `dead_scope`.

The diff is drawn by `fieldView`, which was lifted into `lib/viewmodel.js` on 2026-08-26 (plan:walk seq:46) for exactly this. Do not build a second one. Adopt the control ONE SCREEN AT A TIME — each composes its command differently and passes a different id.
