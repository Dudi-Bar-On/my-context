---
id: TASK-the-preview-screen-draws-a-snapshot-id-that-could-not-be
type: task
title: the preview screen draws a snapshot id that could not be priced as zero tokens, and hides the sweep's never-offered list
status: active
severity: soft
always: false
summary: The preview page shows an unpriceable snapshot item as if it cost nothing, and the sweep answer now names items that were never offered but the page does not show them.
summary_of: 5f774e583de7c647
scope: []
tags:
  - "plan:release"
  - "seq:28"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 7077d8ecbd1b2b99
plan: release
seq: "28"
state: todo
---

# the preview screen draws a snapshot id that could not be priced as zero tokens, and hides the sweep's never-offered list

Found by task 4.2 on 2026-09-23 (TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where): apiSimulate now prices a restore id that resolves to no item as { id, tokens: null } instead of throwing, and apiSimulateSweep now returns a neverOffered: string[] field naming the restore ids it excluded. src/ui/public/screens/preview.js renders tokens through an existing ?? 0, so a measured null is drawn as a zero-width zero-token bar - a measured-nothing drawn as a measured zero (STD-a-measured-zero-is-drawn-and-named) - and the sweep's neverOffered list is served but never drawn. Nothing breaks; the reader is simply told less than the wire carries. Closing condition: the preview draws an unpriceable id as unmeasured with its reason (the reason is on the spill record), the sweep panel lists the never-offered ids with their reasons in the same shape the injected block uses (render.ts's restore clause), and a browser spec (e2e/preview-*.spec.ts) plants a restore id that no longer resolves and asserts both. Files: src/ui/public/screens/preview.js, e2e/preview-*.spec.ts, test/ui coverage of the preview view model if any. Release phase 6 (UI).
