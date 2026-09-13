---
id: TASK-verify-reads-only-the-manifest-and-list-reads-only-the
type: task
title: verify reads only the manifest and list reads only the parser, so a store can be intact and unloadable
status: active
severity: soft
always: false
summary: Two commands each check half of whether the shipped rules are sound, so a set that cannot actually be loaded is still reported as intact.
summary_of: 553d97f54678e95e
scope:
  - src/rules/**
  - src/cli/commands/rules.ts
tags:
  - v2
  - store
  - verify
  - "plan:store"
  - "seq:11"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: bb1d3439b40cee20
plan: store
seq: "11"
state: todo
priority: "3"
---

# verify reads only the manifest and list reads only the parser, so a store can be intact and unloadable

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, S8) as row 81 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `rules verify` reads ONLY the manifest. `rules list` reads ONLY the parser. And `writeManifest` DELIBERATELY gives a row to a file that is too broken to parse.

THE CONSEQUENCE. A store can be checksum-intact and unloadable at the same time, and `verify` will say "intact". The two halves of "is this store good" are checked by two commands and neither asks the other's question.

RELATED, and the same subject from the other side: row 14, where a file the manifest calls unexpected is delivered anyway.
