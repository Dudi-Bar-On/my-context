---
id: TASK-command-descriptions-come-from-the-cli-catalogue-rather-than
type: task
title: command descriptions come from the CLI catalogue rather than the string table, and neither language has plural rules
status: active
severity: soft
always: false
summary: Some text on screen comes from a source the translation system cannot reach, and neither language handles the difference between one and many.
summary_of: 730b48e20e2390f6
scope:
  - src/ui/public/strings/**
  - src/ui/public/screens/palette.js
tags:
  - v2
  - ui
  - i18n
  - strings
  - "plan:walk"
  - "seq:164"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 2479faf6542a4451
plan: walk
seq: "164"
state: todo
priority: "3"
---

# command descriptions come from the CLI catalogue rather than the string table, and neither language has plural rules

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 6.4 and 6.5) as row 105 of `reports/2026-09-13-the-consolidated-findings.md`. TWO STRING-TABLE DEFECTS:

- COMMAND DESCRIPTIONS IN THE COMPOSER ARE ENGLISH-ONLY, because they come from the CLI catalogue rather than from the string table. They render as English inside the Hebrew UI.
- THERE ARE NO PLURAL RULES IN EITHER LANGUAGE: `1 פריטים`, `1 items`.

THE SUBJECT. D47 is an English sentence reaching the screen with no key. The first of these is the general case -- a second source of user-visible text that the translation mechanism cannot see; the second is the same gap in the number formatting.

RELATED: row 30 is the sharpest instance of the same subject, on the Help screen.
