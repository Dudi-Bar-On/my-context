---
id: TASK-declining-a-draft-deletes-it-even-when-the-decline-could-not
type: task
title: declining a draft deletes it even when the decline could not be recorded, and the note says it was
status: active
severity: soft
always: false
summary: Turning down a suggestion throws it away even when the record of that decision could not be saved, and the message afterwards claims the decision was saved.
summary_of: 83f7e14d558d4a97
scope:
  - src/review/**
  - src/core/**
tags:
  - v2
  - core
  - review
  - silent-failure
  - "plan:unread"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 59b1c4eeb029603c
plan: unread
seq: "1"
state: todo
priority: "1"
---

# declining a draft deletes it even when the decline could not be recorded, and the note says it was

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B3) as row 3 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT THE CODE DOES. Declining a review draft deletes both the draft and the item. The ledger write that is supposed to record the decline, `recordDecline`, returns `void` -- so whether it wrote is unobservable at the call site, and the delete happens either way.

THE CONSEQUENCE. With the ledger unwritable a person's decision is destroyed with no record that it was ever taken, and the audit note printed afterwards asserts that the claim IS recorded. A false assertion is worse than silence: it stops the reader looking.

THE CLASS. This is the second of report 3's patterns -- a function that computes whether it succeeded and then throws that answer away at the boundary. The shape of the fix is the shape `recordAudit` already uses elsewhere in the tree: return `{ written, error }` and make the caller refuse to delete when `written` is false.
