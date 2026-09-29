---
id: TASK-the-delivery-log-has-no-reporting-surface-so-a-count-instead
type: task
title: the delivery log has no reporting surface, so a count instead of a promise is still unreachable
status: active
severity: soft
always: false
summary: The tool keeps a record of what it handed over and offers no way at all to look at it, so it still cannot show a count where it currently makes a promise.
summary_of: 2ecb99565b1a4db4
scope:
  - src/rules/**
  - src/cli/**
  - src/mcp/tools.ts
tags:
  - v2
  - store
  - delivery-log
  - reporting
  - "plan:rulings"
  - "seq:82"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 853ea2371833bed6
plan: rulings
seq: "82"
state: todo
priority: "2"
---

# the delivery log has no reporting surface, so a count instead of a promise is still unreachable

This is the residue of a row that has otherwise landed. Row 53 of `reports/2026-09-13-the-consolidated-findings.md` landed at `rulings/71` (commits `040d96fd` to `dc0f14fb`): the recorder now forks a test-written row into a sibling file, and the 157 legacy test rows were MOVED rather than deleted. That item is `state: done`. What follows is the part it did not close.

WHAT IS LEFT. There is no REPORTING SURFACE over `.my_context/.rules/delivered.jsonl`. No CLI command, no MCP tool, no doctor check and no UI screen shows what it holds, so the rule store spec's section 8.2 -- "a count instead of a promise" -- is still unreachable. The product can prove a delivery happened and cannot show anybody that it did.

AND THE RULING CORRECTED TWO OF REPORT 6'S CLAIMS AS TOO STRONG, which is recorded here so nobody re-files them:
- "Nothing reads the file" is wrong: the assertion reads it, on nearly every matched tool call. What is missing is a surface that REPORTS.
- "The `session-start` door has never once delivered successfully" is wrong: the door has not failed -- THE EVENT HAS NOT HAPPENED in this workspace since before the code landed.

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, S3a and S4).

## Relations
- supersedes [[TASK-58-of-its-rows-157-269-were-written-by-test-rules-lane-still]]
- supersedes [[TASK-58-of-its-rows-157-269-were-written-by-test-rules-lane-still-2]]
