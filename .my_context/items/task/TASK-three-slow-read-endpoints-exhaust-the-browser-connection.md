---
id: TASK-three-slow-read-endpoints-exhaust-the-browser-connection
type: task
title: three slow read endpoints exhaust the browser connection pool, so a font waited 5.7 seconds to be requested
status: active
severity: soft
always: false
summary: A handful of slow requests use up every connection the browser will open, so everything else the page needs waits in line behind them.
summary_of: 206feb0af6f4c4de
scope:
  - src/ui/read-model.ts
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - performance
  - read-model
  - "plan:readmodel"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 89c21aaa6ddb3b88
plan: readmodel
seq: "2"
state: todo
priority: "2"
---

# three slow read endpoints exhaust the browser connection pool, so a font waited 5.7 seconds to be requested

FOUND BY TWO REVIEWS INDEPENDENTLY -- report 1 found the symptom and called it puzzling, report 2 found the cause. Row 20 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `/api/status`, `/api/doctor` and `/api/sessions` together exhaust the browser's six-connection HTTP/1.1 pool. `geist-mono-400.woff2` therefore sat 5,748 ms BEFORE ITS REQUEST WAS EVEN SENT -- which is report 1's "4.6 s font", explained.

WHY IT IS ITS OWN ROW AND NOT PART OF ROW 18. Row 18 is the duration of those three calls; this is the effect of that duration on everything else the page needs. Even if the calls got faster, three long-lived connections against a pool of six is a shape the page can be fixed against independently.

THE SUBJECT. The read model is a single-threaded synchronous server and the whole product is behind it.
