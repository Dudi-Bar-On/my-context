---
id: TASK-the-watch-table-sizes-itself-from-its-widest-token-so-seven
type: task
title: the Watch table sizes itself from its widest token, so seven rows fit where twenty would
status: active
severity: soft
always: false
summary: The live feed wraps one long word onto three lines in every row, so the screen whose whole purpose is the feed shows about a third of it.
summary_of: 538b3f957c68ad53
scope:
  - src/ui/public/styles.css
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - layout
  - design-of-record
  - "plan:walk"
  - "seq:152"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: c99e16010e7d4db2
plan: walk
seq: "152"
state: todo
priority: "2"
---

# the Watch table sizes itself from its widest token, so seven rows fit where twenty would

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 2.7) as row 50 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The Watch table is `table-layout: auto` with no column sizing. The Op column gets 95 px and wraps `subagent-stop-untyped` onto three lines, which makes EVERY row 71 px tall. About seven rows fit where twenty would.

WHY IT IS MAJOR RATHER THAN COSMETIC. This is the one screen in the product whose entire purpose is the feed. Losing two thirds of the rows is losing the feature, not the polish.

THE SUBJECT. D44 is the app matched against its design of record: a table that sizes itself from its widest token is not the table the design describes.
