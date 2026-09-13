---
id: TASK-23-of-41-commands-accept-flags-their-banner-never-mentions
type: task
title: 23 of 41 commands accept flags their banner never mentions, and six advertise flags they refuse
status: active
severity: soft
always: false
summary: More than half the commands accept options their own summary never lists, and a few advertise options they then reject.
summary_of: b0f3e88cce4d2891
scope:
  - src/cli/index.ts
  - src/core/command-flags.ts
tags:
  - v2
  - cli
  - help
  - derived
  - "plan:rulings"
  - "seq:76"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 1387809d592423b2
plan: rulings
seq: "76"
state: todo
priority: "2"
---

# 23 of 41 commands accept flags their banner never mentions, and six advertise flags they refuse

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C3) as row 58 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. 23 of 41 registered commands accept flags their banner never mentions -- `audit` omits twelve, `restore` ten, `review` all of them. Six advertise a subcommand-scoped flag at command level, so the banner promises something the command then refuses.

AND THE PROJECT HAS ALREADY SOLVED THIS ONCE, IN THIS FILE. `add` derives `ADD_FLAG_SUMMARY` from `ADD_USAGE`, and it does so BECAUSE the hand-kept copy had already drifted. The mechanism exists, it works, and it was applied to one command out of forty-one.

THE SUBJECT. D51 is a fact kept by hand in a second place, derived instead. The banner and the parser are two copies of the same fact and only one of them is checked.
