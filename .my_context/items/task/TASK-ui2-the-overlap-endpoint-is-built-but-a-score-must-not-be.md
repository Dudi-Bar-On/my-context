---
id: TASK-ui2-the-overlap-endpoint-is-built-but-a-score-must-not-be
type: task
title: "ui2: the overlap endpoint is built but a score must not be RENDERED until open question 1 is ruled"
status: active
severity: soft
always: false
summary: A way to spot near-duplicates exists, and whether to show it while someone is writing something new is undecided.
summary_of: 289ba706de515a18
scope: []
tags:
  - "plan:ui2"
  - "seq:5q"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: c06c9563db44d22c
plan: ui2
seq: 5q
state: done
priority: "1"
---

# ui2: the overlap endpoint is built but a score must not be RENDERED until open question 1 is ruled

Task 5 built POST /api/overlap - pure, tested, and returning a ranked score. Its own header blocks the next step: the mockup's Capture screen states that no similarity and no ranking is shown to the user.

So the endpoint exists and nothing may draw it yet. The module comment says so, and this item is the ruling that releases it.

The question for the owner: at capture time, does the Capture screen show the user that a similar item already exists - and if so, as what? A count, an unordered list of candidates, or a ranked one. The mockup says none of the three; the endpoint assumes the third.

Whoever builds the Capture screen must read this first, or they will render what the design says is not shown.
