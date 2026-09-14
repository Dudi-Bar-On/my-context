---
id: TASK-four-failure-states-are-modelled-in-the-type-and-read-by
type: task
title: four failure states are modelled in the type and read by nothing
status: active
severity: soft
always: false
summary: Four places carefully record that something failed and nothing anywhere ever looks at that record, so the failure is invisible while appearing handled.
summary_of: 7c89fa091d7d0daa
scope:
  - src/core/**
tags:
  - v2
  - core
  - silent-failure
  - types
  - "plan:unread"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 103278647c8964a1
plan: unread
seq: "5"
state: done
priority: "2"
---

# four failure states are modelled in the type and read by nothing

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M12 through M14) as row 37 of `reports/2026-09-13-the-consolidated-findings.md`. FOUR FAILURE STATES THAT EXIST IN THE TYPE AND ARE READ BY NOTHING:

- The anchor pass's `did: 'failed'` has no clause, where the neighbouring `stood-down` does. So a failed pass reports the budget working and hides the defect.
- `ConversationRefresh.anchors` is written, returned, and READ BY NOTHING in `src/` or `test/`.
- `reviewTrigger`'s bug-caused `null` is indistinguishable from "review is switched off".
- The handover ask is withheld at 99% occupancy when the latch will not write, and nothing says so.

THE CLASS. The type is right in every one of these -- somebody modelled the failure properly. What is missing is the reader. That is precisely the subject: a returned failure flag with no consumer is the same defect as no flag at all, except that it looks handled.

Report 4 reached the first of these from the type side as well; it is the `TurnAnchors` case in row 19.
