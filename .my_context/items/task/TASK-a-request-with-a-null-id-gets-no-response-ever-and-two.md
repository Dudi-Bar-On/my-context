---
id: TASK-a-request-with-a-null-id-gets-no-response-ever-and-two
type: task
title: a request with a null id gets no response ever, and two routes advertise different capabilities
status: active
severity: soft
always: false
summary: One badly shaped request makes the server go silent forever with no error, and two ways of asking what it can do return different answers.
summary_of: e45e69907f80f321
scope:
  - src/mcp/**
tags:
  - v2
  - mcp
  - protocol
  - hang
  - "plan:mcpsurface"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: a06d0448c7aab983
plan: mcpsurface
seq: "3"
state: todo
priority: "2"
---

# a request with a null id gets no response ever, and two routes advertise different capabilities

FOUND BY TWO REVIEWS. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M4) and report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, m21) reached it separately. Row 63 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. A request with `id: null` GETS NO RESPONSE, EVER. `serveStdio` has no timeout and no `error` handler on either stream, so a client that spells its first id that way hangs indefinitely with nothing on either side saying why.

A SECOND DEFECT ON THE SAME SURFACE: `initialize` and `server/discover` advertise TWO DIFFERENT `capabilities.tools`. A client that asks one way and a client that asks the other are told different things about the same server.

THE SUBJECT. The MCP surface has to declare what it does, truthfully and identically, on every route a client can ask through -- and it has to answer at all.
