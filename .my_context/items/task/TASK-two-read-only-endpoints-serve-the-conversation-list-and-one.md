---
id: TASK-two-read-only-endpoints-serve-the-conversation-list-and-one
type: task
title: two read-only endpoints serve the conversation list and one transcript
status: active
severity: soft
always: false
summary: The archive becomes reachable over HTTP, bounded and read-only, before any screen is drawn.
summary_of: 214483d7840d70ea
scope:
  - src/ui/server.ts
  - src/ui/read-model.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 448d9b7eebb5e49d
plan: archive
seq: "2"
state: done
priority: "1"
verified_on: 2026-09-07
---

# two read-only endpoints serve the conversation list and one transcript

Step 2 of five in docs/superpowers/specs/2026-09-04-conversation-archive-design.md. Depends on the index from step 1.

GET /api/conversations lists what is held. GET /api/conversations/:id serves one transcript.
Both read-only and both BOUNDED, for the reason this project has met twice on other surfaces:
a transcript can be thirteen megabytes, and an endpoint that will hand back everything is a
way to take the server down by clicking a link.

The transcripts are read IN PLACE rather than copied. There is no second store of
conversation text to keep in step, and nothing here should create one.

Say what a bound does when it is reached. This project already refuses a silent truncation:
a reader must be told what was held back and how to reach it, the way the audit stream and
the index tier already say so.
