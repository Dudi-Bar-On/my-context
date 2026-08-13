---
id: LESSON-declared-but-never-consumed
type: lesson
title: Configuration was declared, defaulted, and never read
status: active
severity: soft
always: false
scope: []
tags:
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 5481374ef27aa9eb
---

# Configuration was declared, defaulted, and never read

`schema_version` was written on every open and never compared. `budgets.index` had a
default of 150 and nothing consumed it, so the index grew unbounded while the config
advertised a limit. `computeItemChecksum` was exported and never called. Each passed
every test, because dead code cannot fail.

## Observations
- [method] Grep each configuration key for a read, not just a write
- [symptom] A field whose only appearances are its definition and its default
