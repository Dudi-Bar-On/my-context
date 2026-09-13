---
id: TASK-the-cli-cannot-observe-a-failed-write-to-stdout-so-a
type: task
title: the CLI cannot observe a failed write to stdout, so a redirected run truncates and exits zero
status: active
severity: soft
always: false
summary: When output cannot be written the command finishes as though it succeeded, so a saved file can be cut short and nothing says so.
summary_of: bef2f70af2d8dd63
scope:
  - src/cli/index.ts
  - src/cli/**
tags:
  - v2
  - cli
  - silent-failure
  - stdout
  - "plan:swallow"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: c9a586da05dca23c
plan: swallow
seq: "5"
state: todo
priority: "1"
---

# the CLI cannot observe a failed write to stdout, so a redirected run truncates and exits zero

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B9) as row 10 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The CLI cannot observe a failed write to stdout AT ALL. There is one `console.log`, constructed with `ignoreErrors: true`; there is no `EPIPE` handler and no `unhandledRejection` handler anywhere in the binary.

THE CONSEQUENCE FOR A SCRIPT. `mycontext doctor --json > report.json` on a full disk truncates the file and exits 0. Every downstream consumer treats a partial document as a complete one, and the exit code agrees with them.

WHY IT BELONGS IN THIS SUBJECT. Like the browser shell, this is not a catch that is too wide. There is no observation point: the failure has nowhere to be seen even in principle until one is created.
