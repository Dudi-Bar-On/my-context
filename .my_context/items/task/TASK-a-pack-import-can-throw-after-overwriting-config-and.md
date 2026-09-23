---
id: TASK-a-pack-import-can-throw-after-overwriting-config-and
type: task
title: a pack import can throw after overwriting config and creating part of the items, and the refusal reads as nothing happened
status: active
severity: soft
always: false
summary: Importing a bundle can stop halfway after it has already changed settings and added some entries, then report a failure that sounds as if nothing was touched.
summary_of: 8ba201c61f89f43a
scope:
  - src/pack/**
tags:
  - v2
  - store
  - pack
  - partial-write
  - "plan:store"
  - "seq:7"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7d8c2a6cccca93fa
plan: store
seq: "7"
state: doing
priority: "2"
---

# a pack import can throw after overwriting config and creating part of the items, and the refusal reads as nothing happened

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M22) as row 43 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT THE CODE DOES. `applyImport` can throw mid-loop AFTER it has already overwritten `config.json` and created an arbitrary prefix of the new items -- and the refusal it prints reads as though nothing happened.

AND THE WRECKAGE IS UNREACHABLE. `writeImportRecord` never runs, so `pack list` does not show the pack; and because it does not, `review promote --all --pack` cannot reach the orphaned drafts that WERE created. The user is left with a half-applied pack, a changed config, and no command that names it.

THE SHAPE OF THE FIX, as the report frames it: the import needs either a transaction boundary or a record written FIRST, so that a partial apply is something the product can see and offer a route out of.
