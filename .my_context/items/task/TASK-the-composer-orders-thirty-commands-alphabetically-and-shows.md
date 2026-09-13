---
id: TASK-the-composer-orders-thirty-commands-alphabetically-and-shows
type: task
title: the Composer orders thirty commands alphabetically and shows the Glob tester for commands with no scope
status: active
severity: soft
always: false
summary: A picker of thirty commands is ordered alphabetically rather than by what people use, and half the screen is given to a tester the chosen command does not need.
summary_of: 6276c2b4ddb7d844
scope:
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - picker
  - "plan:builder"
  - "seq:18"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: c0f04ea5caffa1fb
plan: builder
seq: "18"
state: todo
priority: "2"
---

# the Composer orders thirty commands alphabetically and shows the Glob tester for commands with no scope

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 2.2) as row 52 of `reports/2026-09-13-the-consolidated-findings.md`, with a correction from report 2.

WHAT WAS MEASURED. The Composer opens on `ack . write`, because `ack` sorts first among thirty options -- while `search` and `show`, the two a reader actually wants, sit at positions 29 and 28. The Glob tester takes half the screen even when the selected command has no scope argument at all.

WHAT REPORT 2 CORRECTED. The placeholder now exists: the select's first option is empty and nothing is preselected. So the "opens on ack" half is addressed and the ORDERING and the unconditional Glob tester are what remain.

THE SUBJECT. D11 is long pickers -- a list of thirty where alphabetical order is not the order anybody reads in.
