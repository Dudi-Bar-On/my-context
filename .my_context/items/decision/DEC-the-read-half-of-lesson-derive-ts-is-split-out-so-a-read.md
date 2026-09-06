---
id: DEC-the-read-half-of-lesson-derive-ts-is-split-out-so-a-read
type: decision
title: the read half of lesson/derive.ts is split out so a read server may serve staged lessons
status: active
severity: soft
always: false
summary: Listing what is waiting to be reviewed no longer requires loading the code that writes.
summary_of: 359efaacab57b7f4
scope:
  - src/lesson/**
  - src/ui/read-model.ts
tags:
  - v2
  - architecture
  - lesson
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: f950ed2efdff06b6
---

# the read half of lesson/derive.ts is split out so a read server may serve staged lessons

Owner ruling 2026-09-06, unblocking `builder/10`’s third field.

THE PROBLEM, measured by the D11 lane: the `key` field on `lesson-accept` and `lesson-discard`
cannot gain a picker because no endpoint serves a staged lesson, and `listStaging` lives in
`src/lesson/derive.ts`, which VALUE-IMPORTS `createItem` from `core/mutate.ts`. `src/ui/read-model.ts`
had already refused this exact read for this exact reason and named it an owner ruling.

THE RULING: split the read half into its own module that imports nothing which writes, so the read
server can serve staged lessons without the write surface entering its import graph.

THIS IS NOT A NEW PATTERN - it is the one `builder/4` used hours earlier and PROVED. Its
`test/ui/command-check.test.ts` walks the real transitive import graph and fails if `execute*.ts`,
`src/cli/index.ts` or `node:child_process` becomes reachable; that test FAILED on its first run and
found a genuine leak (`read-model.ts` -> `doctor/checks.ts` -> `node:child_process`). The same
guard must cover this split, or the boundary is asserted rather than enforced.

WHAT MUST NOT HAPPEN: moving the write half instead, or re-exporting the read half from the module
that writes. Either leaves the import graph exactly as it was while looking like a fix.
