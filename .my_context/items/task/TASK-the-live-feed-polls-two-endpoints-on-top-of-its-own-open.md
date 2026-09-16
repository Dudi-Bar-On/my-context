---
id: TASK-the-live-feed-polls-two-endpoints-on-top-of-its-own-open
type: task
title: the live feed polls two endpoints on top of its own open stream, against a server that stalls
status: active
severity: soft
always: false
summary: The live feed still asks two pages for updates on top of its own open stream; the pages are fast now, and the double asking itself is untouched.
summary_of: 1e34bc5504b897ce
summary_was:
  - 2026-09-16 The live view keeps asking for two figures it already has an open connection for, adding work to a server that is already the bottleneck.
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
checksum: 81bbb521e362495e
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

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN aebc76f0 — measured and deliberately not changed — the fix lives in `src/ui/public/**` and `watch-model.ts`, out of that lane's scope

IT WAS NOT IN THE 23 THIS RECONCILIATION STARTED FROM, and the reason is worth keeping because it bounds the gate: the commit wrote "`readmodel/2` and `/4`", and a bare `/4` is not an address any detector can resolve. `npm run check:board` would not have found this one, and a person reading the commit did.

WHAT LANDED: nothing here. WHAT REMAINS: all of it, and it is now cheaper — the server this polls is no longer the thing that stalls, so the double poll is a client-side cost rather than a compounding one.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`.
