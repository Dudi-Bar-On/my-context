---
id: TASK-every-cli-invocation-prints-an-experimental-warning-that-is
type: task
title: every CLI invocation prints an experimental warning that is suppressed at all twelve other entry points
status: active
severity: soft
always: false
summary: Every command a person types prints a warning that has already been silenced everywhere else in the project.
summary_of: 7db4142513b846bd
scope:
  - src/cli/index.ts
tags:
  - v2
  - cli
  - noise
  - "plan:cliscript"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: c10c687d70a81040
plan: cliscript
seq: "5"
state: todo
priority: "3"
---

# every CLI invocation prints an experimental warning that is suppressed at all twelve other entry points

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C9) as row 112 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Every `mycontext` invocation prints `ExperimentalWarning: SQLite is an experimental feature`.

AND IT IS SOLVED AT EVERY OTHER ENTRY POINT IN THE PROJECT -- all eleven hooks, the statusline installer and the review pass -- and NOT at the one a person types. That asymmetry is the finding: the fix exists, is applied twelve times, and was never applied to the CLI.

THE CONSEQUENCE FOR A SCRIPT. Two lines of warning on stderr before every command, on a surface whose stdout and stderr discipline is otherwise deliberate -- report 6 measured eight commands redirected and through a pipe as byte-identical every time and called that the one area it would change nothing.

CONFIRMED WHILE FILING THIS ITEM: it is still printed on every run of the CLI from source.
