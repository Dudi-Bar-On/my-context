---
id: INV-select-is-pure
type: invariant
title: core/select is a pure function
status: active
severity: hard
always: false
scope:
  - src/core/select.ts
tags:
  - architecture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 4535db6ef83cc742
---

# core/select is a pure function

No I/O, no filesystem, no clock, no `Store` import, and no mutation of its inputs.
Purity is the design’s central bet: it makes the entire behaviour of the system
testable as data-in/data-out and debuggable from a fixture rather than from inside
a live session. Every rule about what reaches the context window lives here.

## Observations
- [invariant] select imports only types and config
- [invariant] fitToBudget and buildIndex sort copies, never the caller’s array
- [rule] renderItemBlock may be imported because it is pure; a Store import would not be
