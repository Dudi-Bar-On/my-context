---
id: TASK-the-401-is-the-read-surface-s-one-write-and-it-makes-the
type: task
title: the 401 is the read surface's one write, and it makes the next read return 503
status: active
severity: soft
always: false
summary: Turning a request away is the only thing the read-only screens ever write, and it makes the very next read refuse; tests must expect that.
summary_of: 73fb5888f1326743
scope: []
tags:
  - "plan:ui3"
  - "seq:8p"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: d17e8c47b6e9c322
plan: ui3
seq: 8p
state: done
priority: "2"
---

# the 401 is the read surface's one write, and it makes the next read return 503

Found by ui3 task 8 while building the idle proof, and turned from a trap into an assertion.

The plan's sample makes an unauthorised request BEFORE an authorised one. That order cannot answer the question it asks, because the refusal is the read surface's single write: it appends an audit record, which leaves the projection BEHIND its log, so the authorised read that follows returns 503 rather than 200.

Inverted and pinned instead: 200 with projectionState fresh, then 401 with an empty body, then 503 carrying projectionState 'behind' and naming mycontext audit. That is the read-only door's report-never-repair rule proved on the wire, with no clock involved.

Worth knowing beyond this test: any sequence that refuses a request and then reads must expect 503, and any fixture that refuses first and asserts 200 after is asserting something the design forbids.
