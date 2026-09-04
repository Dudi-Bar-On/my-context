---
id: TASK-the-spill-ratio-needs-an-audit-backed-endpoint
type: task
title: the spill ratio needs an audit-backed endpoint
status: active
severity: soft
always: false
summary: One of the four required charts has nothing serving it, so what gets pushed out has no data to draw from.
summary_of: c286390a39d72ed7
scope: []
tags:
  - "plan:ui1"
  - "seq:17d"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: c256afc72bc8e69e
plan: ui1
seq: 17d
state: done
priority: "1"
---

# the spill ratio needs an audit-backed endpoint

Fourth of the four charts the owner ruled must be drawn.

The spill ratio (#ratio, sim.ratio, sim.ration) reads audit_item.role through topItems - the audit projection. No route in the web-ui plans exposes it.

The read-only door already exists and is the pattern to follow: openProjectionReadOnlyChecked, stale reported as a 503 naming mycontext audit and never repaired, never-built answered as the absent empty state rather than as zeroes. watch-model.ts and ask-model.ts both do it and readProjection is exported from watch-model for exactly this reuse - one spelling of the policy.
