---
id: TASK-a-locked-projection-file-makes-discard-fail-silently-so-a
type: task
title: a locked projection file makes discard fail silently, so a schema bump stamps the new version over the old layout
status: active
severity: soft
always: false
summary: When the tool tries to throw away and rebuild its audit index while another program holds the file, the deletion fails without a word and the new version number is written onto the old structure.
summary_of: 2860a98bea9a0709
scope: []
tags:
  - "plan:release"
  - "seq:24"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 10b42acdb4483f24
plan: release
seq: "24"
state: todo
---

# a locked projection file makes discard fail silently, so a schema bump stamps the new version over the old layout

Found by lane 3.9 round 3 on 2026-09-23 and reproduced live: src/core/audit-db.ts:781-799 discard() and :830-834 — on Windows a projection file held by another process cannot be deleted; discard returns as if it had succeeded, and the PROJECTION_VERSION bump then writes the new version over the old schema, so the next reader trusts a layout that is not there. The lane abandoned a version bump because of it and added indexes without one. Closing condition: discard reports the failure (a refusal naming the file and the holder if known), a version bump refuses to proceed while the old file stands, and a test plants a held file and asserts both; INV-nothing-is-dropped-silently. Files: src/core/audit-db.ts, test/core/audit-projection.test.ts. Release phase 4 (silent failures).
