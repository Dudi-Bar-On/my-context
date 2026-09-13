---
id: TASK-the-environment-variable-that-steers-every-door-is-ignored
type: task
title: the environment variable that steers every door is ignored by all three rules subcommands
status: active
severity: soft
always: false
summary: A setting that changes which set of rules is used is ignored by the very commands the tool tells you to run to check which rules you have.
summary_of: c73c3b66c0b37f16
scope:
  - src/rules/**
  - src/cli/commands/rules.ts
tags:
  - v2
  - store
  - env
  - divergence
  - "plan:store"
  - "seq:8"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 05d1dcb9705151df
plan: store
seq: "8"
state: todo
priority: "2"
---

# the environment variable that steers every door is ignored by all three rules subcommands

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, S5) as row 55 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `MYCONTEXT_RULES_DIR` steers every door and is IGNORED by all three `mycontext rules` subcommands. With it set, the doors deliver directory X while `rules list` and `rules verify` answer about the package's own directory.

AND THE PRODUCT SENDS THE READER TO EXACTLY THOSE TWO COMMANDS. `missedDoorLine` tells whoever reads it to run `rules list` and `rules verify` -- the two commands guaranteed to describe a different store from the one that was delivered.

THE CONSEQUENCE. Anybody debugging what was delivered is handed a confident answer about the wrong directory, with nothing disclosing the divergence.
