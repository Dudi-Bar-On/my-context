---
id: TASK-the-live-feed-polls-two-endpoints-on-top-of-its-own-open
type: task
title: the live feed polls two endpoints on top of its own open stream, against a server that stalls
status: active
severity: soft
always: false
summary: The live view keeps asking for two figures it already has an open connection for, adding work to a server that is already the bottleneck.
summary_of: 6736c863efc0a1cf
scope:
  - src/ui/public/screens/**
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - polling
  - sse
  - "plan:readmodel"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 401a65c00c2b1c80
plan: readmodel
seq: "4"
state: todo
priority: "3"
---

# the live feed polls two endpoints on top of its own open stream, against a server that stalls

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 8.3) as row 104 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The live feed polls `/api/watch/context` and `/api/watch/volume` ON TOP OF its own already-open SSE stream -- 3 and 2 requests inside a 20-second window.

WHY IT IS UNDER THIS SUBJECT RATHER THAN FILED AS TIDINESS. The server it is polling is single-threaded and synchronous, and rows 18 and 20 measure what that costs: two endpoints block everything for about four seconds per call, and three concurrent requests exhaust the browser's connection pool. Duplicated work against THAT server is not free.

THE QUESTION THE WORK ANSWERS: either the stream carries these two figures and the polls go, or the stream does not and the reason is written down.
