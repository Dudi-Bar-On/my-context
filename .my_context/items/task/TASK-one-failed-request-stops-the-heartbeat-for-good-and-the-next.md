---
id: TASK-one-failed-request-stops-the-heartbeat-for-good-and-the-next
type: task
title: one failed request stops the heartbeat for good, and the next success hides the banner that explained it
status: active
severity: soft
always: false
summary: After a single failed background request the page stops checking whether it is up to date, then removes the warning, so it looks healthy while every live signal is dead.
summary_of: 4a5521cd0ba8b4ae
scope:
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - silent-failure
  - heartbeat
  - inferred
  - "plan:swallow"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: f4dbcbcda5fc56ce
plan: swallow
seq: "3"
state: todo
priority: "1"
---

# one failed request stops the heartbeat for good, and the next success hides the banner that explained it

INFERRED, NOT REPRODUCED. The sequence was read out of the source; it was never driven in a browser. Report 3 says of this one specifically that it "deserves a Playwright reproduction before it is filed" -- SO THE FIRST STEP OF THIS WORK IS THAT REPRODUCTION, not the fix. Drive one failed request, then a 200, and observe whether the heartbeat is dead and the banner gone. If the sequence cannot be produced, that is a legitimate outcome and this item records it.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B8) as row 6 of `reports/2026-09-13-the-consolidated-findings.md`.

THE SEQUENCE AS READ. One failed request calls `stopHeartbeat()`. Nothing re-arms it. The next successful response then hides the banner that explained the failure. From that point the page looks healthy and has no staleness detection, no drift chip and no occupancy -- for the rest of its life.

THE CONSEQUENCE. The user is shown a confident, healthy-looking screen whose live signals have all stopped. It is the benign branch taken on a failure nothing observes.

RELATED: row 106 of the same table disables the boot heartbeat ping, and in combination that is the only beat some pages ever get.
