---
id: TASK-asking-a-command-for-help-exits-1-on-all-38-commands-that
type: task
title: asking a command for help exits 1 on all 38 commands that take flags
status: active
severity: soft
always: false
summary: Asking any command for help prints the right guidance but reports failure, so any script checking the result concludes the command does not exist.
summary_of: 88c81cce6a0b5749
scope:
  - src/cli/index.ts
  - src/core/command-flags.ts
tags:
  - v2
  - cli
  - help
  - exit-code
  - "plan:cliscript"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7bd19118251b7eb6
plan: cliscript
seq: "2"
state: done
priority: "2"
---

# asking a command for help exits 1 on all 38 commands that take flags

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C1) as row 47 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `<command> --help` EXITS 1 ON ALL 38 COMMANDS THAT TAKE FLAGS. The output is the correct usage block -- printed behind the line `my_context: unknown option "--help"`.

AND THE SAME BINARY IS INCONSISTENT WITH ITSELF: bare `mycontext` exits 1, while `mycontext --help` exits 0, printing byte-identical output.

THE CONSEQUENCE. Every wrapper, Makefile and agent that checks the exit code of `--help` concludes the command does not exist. The help text a person needs is reached only by ignoring the status the tool reported.

CONFIRMED WHILE FILING THIS ITEM: `node src/cli/index.ts add --help` still prints `my_context: unknown option "--help".` above the correct usage block.
