---
id: TASK-liststaging-discards-its-skip-list-against-its-own-twenty
type: task
title: listStaging discards its skip list, against its own twenty-line argument for keeping it
status: active
severity: soft
always: false
summary: A count of pending items leaves out the ones it could not read, which is exactly the mistake the comment above it spends twenty lines warning against.
summary_of: 2fbd158116e2f816
scope:
  - src/lesson/**
  - src/core/**
tags:
  - v2
  - core
  - silent-drop
  - "plan:unread"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 76a3fc08996e74e1
plan: unread
seq: "4"
state: todo
priority: "2"
---

# listStaging discards its skip list, against its own twenty-line argument for keeping it

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M4) as row 35 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `listStaging` throws away its skip list. Both consumers call the lossy wrapper, so the count they print is of what was read, not of what is there.

WHY THIS ONE IS SHARPER THAN THE REST OF ITS CLASS. The function carries a TWENTY-LINE DOCBLOCK arguing the exact case against doing this: "a status line reading 'three staged lessons' over a directory of five files was indistinguishable from a correct one". The argument is recorded, it is right, and the code does the thing it argues against.

THE SHAPE OF THE FIX. Return the skips, and make both consumers print them -- the product's own measured-zero discipline, which both UI reviews named as its signature.
