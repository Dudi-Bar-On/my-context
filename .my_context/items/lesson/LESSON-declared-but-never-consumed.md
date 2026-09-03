---
id: LESSON-declared-but-never-consumed
type: lesson
title: Configuration was declared, defaulted, and never read
status: active
severity: soft
always: false
summary: Settings were defined, given defaults and then never read anywhere, and nothing failed, because code that never runs cannot fail a test.
summary_of: b1c7f2936b39e146
scope: []
tags:
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 560d2bafa74ed088
---

# Configuration was declared, defaulted, and never read

`schema_version` was written on every open and never compared. `budgets.index` had a
default of 150 and nothing consumed it, so the index grew unbounded while the config
advertised a limit. `computeItemChecksum` was exported and never called. Each passed
every test, because dead code cannot fail.

## Observations
- [method] Grep each configuration key for a read, not just a write
- [symptom] A field whose only appearances are its definition and its default
