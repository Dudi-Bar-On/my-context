---
id: TASK-every-hook-event-fired-twice-because-the-plugin-was
type: task
title: every hook event fired twice because the plugin was registered from two places
status: active
severity: soft
always: false
summary: A self-registered settings file duplicated the plugin manifest, so every event was recorded twice and every injection billed twice.
summary_of: 3f35b9405fa3040d
scope: []
tags:
  - v2
  - backfill
  - "plan:hooks"
  - "seq:29"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 0ae635bce0a258e4
plan: hooks
seq: "29"
state: done
verified_on: 2026-09-04
priority: "3"
---

# every hook event fired twice because the plugin was registered from two places

The workspace move made the plugin root and the project root the same directory, so a self-registration written when they differed became a second copy. All eighteen events fired twice, doubling every audit-derived count and injecting 198.8 KB of governing items twice in one session. Shipped in c050dd5, with a test that now requires the file to be absent.
