---
id: TASK-a-counter-that-can-no-longer-be-written-reads-as-not-enough
type: task
title: a counter that can no longer be written reads as not enough activity yet, every single turn
status: active
severity: soft
always: false
summary: When a counter cannot be saved the status line keeps saying there has not been enough activity, when the truth is that the feature can never run again.
summary_of: 03d636b67cb6845e
scope:
  - src/review/**
  - src/core/**
tags:
  - v2
  - core
  - measured-zero
  - silent-failure
  - "plan:unread"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: cdcb23518eaa0a4e
plan: unread
seq: "3"
state: todo
priority: "2"
---

# a counter that can no longer be written reads as not enough activity yet, every single turn

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M3) as row 34 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `bumpCounter` returns `written: false` when it could not write, and its ONLY caller drops it.

THE CONSEQUENCE, and it is a sentence that is true and misleading at once. With `state/` unwritable every turn prints "review: no pass -- 0 of 25 tool call(s)". That is a true statement about the file. A reader takes it as "not enough activity yet". The truth is that the subsystem CAN NEVER FIRE AGAIN, and nothing anywhere says so.

THE CLASS. Report 3's pattern P2 -- a returned failure flag with no reader -- and simultaneously a measured zero drawn over an unmeasured one.
