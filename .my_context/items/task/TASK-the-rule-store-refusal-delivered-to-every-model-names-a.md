---
id: TASK-the-rule-store-refusal-delivered-to-every-model-names-a
type: task
title: the rule-store refusal delivered to every model names a remedy whose condition is always false
status: active
severity: soft
always: false
summary: The message every assistant receives when the rule store refuses tells it to run a repair that can never do anything, because the check behind it compares a value with itself.
summary_of: e5348928aadf753c
scope:
  - src/rules/**
tags:
  - v2
  - store
  - refusal
  - dead-remedy
  - "plan:walk"
  - "seq:161"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: e02a28dde925ec10
plan: walk
seq: "161"
state: done
priority: "2"
---

# the rule-store refusal delivered to every model names a remedy whose condition is always false

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M23) as row 44 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The rule-store refusal that is delivered into EVERY model's context window at every door names `mycontext rules verify --restore` as the remedy. That code path compares `entriesDir()` against `entriesDir()`, so the condition is ALWAYS FALSE and `restoreEntries` is unreachable.

WHY IT IS THE WORST PLACE FOR THIS DEFECT. This is not a refusal a person stumbles on -- it is text written FOR A MODEL and injected at every door. Every agent that reads it is told to run a command that cannot do what it says.

THE SUBJECT. `RULE-a-refusal-states-its-unblocking-condition` is satisfied in form and broken in fact: the condition is named and the route to it does not exist. See row 68 for the CLI half of the same class, and for report 1's measurement that the UI does this WELL.
