---
id: INV-nothing-is-dropped-silently
type: invariant
title: Nothing is ever dropped silently
status: active
severity: hard
always: true
scope: []
tags:
  - architecture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 674ec33882f8e99f
---

# Nothing is ever dropped silently

Every item excluded for budget is recorded in `spilled` with a reason and surfaced
in the rendered output. The same holds for truncated index lines, retired items,
drafts, per-file parse errors, duplicate ids, unresolvable symlinks, and items whose
category is disabled or misspelled. Silent truncation is the one unacceptable failure.

## Observations
- [invariant] An item excluded from injection appears in spilled, the index, or a LoadError
- [history] Two Critical bugs shipped past per-task review because they dropped items at seams no single task owned: a disabled or misspelled category vanished entirely, and symlinked item files were skipped
- [method] A "silence audit" — constructing inputs whose output should mention them and checking it does — catches these where ordinary tests do not #testing
