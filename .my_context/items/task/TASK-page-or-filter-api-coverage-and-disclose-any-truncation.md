---
id: TASK-page-or-filter-api-coverage-and-disclose-any-truncation
type: task
title: page or filter /api/coverage, and disclose any truncation
status: active
severity: soft
always: false
summary: The file picker offers every file in the project with no search and no limit; it needs one, and it must say when it has left files out.
summary_of: 51c8919d152aa495
scope: []
tags:
  - "plan:ui1"
  - "seq:17e"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 4eda189d453ade40
plan: ui1
seq: 17e
state: done
priority: "2"
---

# page or filter /api/coverage, and disclose any truncation

Ruled by the owner 2026-08-22.

/api/coverage returns every file in the repository as the path picker's options - 614 here, unbounded elsewhere. There is no limit and no search.

The walk itself is already recorded as a measured performance problem, and the picker is the one place a user meets it directly.

What it needs: a search, or a cap. INV-nothing-is-dropped-silently decides the shape of the cap - a truncated list must SAY it is truncated and how many were left out. coverageFiles already walks limit+1 and slices back for exactly this reason, so the count is available; the endpoint must carry it and the picker must show it.

Never a silent cap. A picker that quietly omits the file a user is looking for is worse than one that says it stopped at 200.
