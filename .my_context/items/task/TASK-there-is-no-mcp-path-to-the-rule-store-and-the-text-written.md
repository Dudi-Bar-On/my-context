---
id: TASK-there-is-no-mcp-path-to-the-rule-store-and-the-text-written
type: task
title: there is no MCP path to the rule store, and the text written for a model tells it to run two terminal commands
status: active
severity: soft
always: false
summary: An assistant with no terminal access cannot reach the rule store at all, although the message written for it says to check the store with two terminal commands.
summary_of: 7f30e96ca54c8606
scope:
  - src/mcp/tools.ts
  - src/plugin/parity.ts
  - src/rules/**
tags:
  - v2
  - mcp
  - parity
  - "plan:mcpsurface"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 971366952885e35f
plan: mcpsurface
seq: "1"
state: done
priority: "2"
---

# there is no MCP path to the rule store, and the text written for a model tells it to run two terminal commands

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, M1) as row 61 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. There is NO MCP path to the rule store at all -- while `missedDoorLine`, text written FOR A MODEL, instructs it to run `mycontext rules list` and `mycontext rules verify`. An agent whose Bash tool is denied can do neither.

WHY IT IS THE LARGEST GAP AND NOT MERELY A GAP. This project has its own answer to CLI/MCP parity in `src/plugin/parity.ts`, test-enforced in both directions, and report 6 calls that one of the best things in the four surfaces it reviewed. The deliberate absences are named there. This one is not deliberate: it is the largest CLI-to-MCP gap in the product that nothing argues for.

THE SUBJECT. The MCP surface is what a model sees of this product. What it offers, and what it says about what it offers, has to be true for a reader that never opens a terminal.
