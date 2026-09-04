---
id: TASK-nine-declarations-went-stale-the-moment-three-features
type: task
title: nine declarations went stale the moment three features landed in one day
status: active
severity: soft
always: false
summary: Three lanes verified with targeted tests only, and the full suite then found nine lists that no longer agreed with the code.
summary_of: 925924724c796998
scope: []
tags:
  - v2
  - backfill
  - "plan:walk"
  - "seq:136"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 3b5cbc111f21e1b6
plan: walk
seq: "136"
state: done
verified_on: 2026-09-04
priority: "3"
---

# nine declarations went stale the moment three features landed in one day

A word map spelling tool counts, a WRITERS list, an F2 registry and two expected-op lists all had to agree with changes that had just shipped, and none did. Every failing test named its own remedy. Closed in 971534f. The lasting fix is procedural and is now in every brief: a lane runs the full npm test, not only targeted tests.
