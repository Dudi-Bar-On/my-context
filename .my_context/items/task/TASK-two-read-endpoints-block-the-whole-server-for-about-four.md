---
id: TASK-two-read-endpoints-block-the-whole-server-for-about-four
type: task
title: two read endpoints block the whole server for about four seconds per call, and that is the seven-second cold load
status: active
severity: soft
always: false
summary: Two of the pages the tool loads on start take about four seconds each and hold everything else up, every single time they are called.
summary_of: 5463da209315fdd0
scope:
  - src/ui/read-model.ts
  - src/ui/server.ts
tags:
  - v2
  - ui
  - performance
  - read-model
  - "plan:readmodel"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: a2c02eddb2689d7f
plan: readmodel
seq: "1"
state: todo
priority: "1"
---

# two read endpoints block the whole server for about four seconds per call, and that is the seven-second cold load

THE SEVEN SECONDS ARE CONFIRMED BY TWO INDEPENDENT REVIEWS. WHAT IS REFUTED IS REPORT 1'S CAUSE, and both measurements are kept here because the consolidation did not pick a winner on the attribution and did not need to:

- Report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`) measured 7,046 ms to a usable page and attributed it to `app.js` at 4,632 ms and `styles.css` at 4,618 ms.
- Report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`) measured 7,311 ms -- CONFIRMED -- and measured `app.js` at 21 ms and `styles.css` at 7 ms. The stall is `/api/status` (3,829-4,669 ms) and `/api/doctor` (3,812-3,920 ms) on a single-threaded synchronous server.

THE PROOF THAT IT SERIALISES EVERYTHING. A serial-versus-parallel test: parallel cost the same as serial (8,437 ms against a serial sum of 9,905 ms). And IT RECURS ON EVERY CALL rather than once per load, warm.

WHAT IS NOT KNOWN, and it blocks the fix rather than the finding: nobody profiled the server process -- it is the owner's and was off limits. So the first move here is about half a day of measurement, NOT a fix. That is why the consolidation names this its sixth priority and not one of its five.

Row 18 of `reports/2026-09-13-the-consolidated-findings.md`.
