---
id: TASK-show-accepts-json-and-silently-drops-it-and-closing-that
type: task
title: show accepts --json and silently drops it, and closing that needs a decision about giving show a parser
status: active
severity: soft
always: false
summary: The most used read command accepts a flag asking for machine-readable output and quietly ignores it, and fixing that changes how the command behaves.
summary_of: 8eae2b709c511bd2
scope:
  - src/cli/index.ts
  - src/cli/json-envelope.ts
tags:
  - v2
  - cli
  - json
  - needs-ruling
  - "plan:cliscript"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 212a1baad5dd5bd2
plan: cliscript
seq: "3"
state: todo
priority: "2"
---

# show accepts --json and silently drops it, and closing that needs a decision about giving show a parser

This is the residue of a row that has otherwise landed, AND IT NEEDS A DECISION BEFORE ANYBODY WRITES CODE. Row 57 of `reports/2026-09-13-the-consolidated-findings.md` was ruled and built at `rulings/72` (commit `86a0c840`): refusals stay on STDOUT, the exit code does not change, and 32 genuine forms now emit a JSON envelope derived mechanically from the same flag tables `refuseUnknownFlag` uses. That item is `state: done`.

THE DECISION LEFT OVER. `show` IS FLAGLESS. It accepts `--json` and SILENTLY DROPS IT, printing Markdown even on success. That is a breach of `INV-nothing-is-dropped-silently`, not a mis-typed channel, and it was left failing WITH THE REASON ASSERTED IN THE TEST rather than quietly passed. Closing it requires `show` to gain a flag parser, which is a BEHAVIOUR CHANGE on the most-used read command in the product -- so the decision is: give `show` a parser and a JSON form, or make it refuse `--json` by name. Somebody has to choose before the work exists.

WHY IT MATTERS. `mycontext show X --json` was the consolidation's own headline example, and it is the one form that still does not do what the flag promises.
