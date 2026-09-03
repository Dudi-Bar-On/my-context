---
id: REQ-an-item-must-be-editable
type: requirement
title: There must be a supported way to edit an item
status: active
severity: hard
always: false
summary: There has to be a supported way to change an entry after writing it; for a while there was none, and any edit by hand made every command refuse to run.
summary_of: 4d8364c5b9376d5c
scope:
  - src/core/mutate.ts
  - src/cli/**
tags:
  - usability
  - gap
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: a8283c6fabe319b4
kind: functional
---

# There must be a supported way to edit an item

**Status: BUILT, and this requirement is met — verified by execution in the Phase 6 census
(2026-08-16).** `mycontext edit` changes an item's title, body, scope, tags, severity, always,
status and extra through a gate that scales to what the change can do; `harden`, `soften`,
`pin` and `unpin` are spellings of that same edit; `update_item` is the agent surface on the
MCP server; and every change lands in the audit log with its actor and the fields it moved.
`mycontext add` now takes `--body`, `--file`, `--note`, `--scope`, `--tags` and `--severity`,
so a useful item is created in one shot — the [option] below asking for flags on `add` is
what shipped. A deliberate hand-edit is resealed with `mycontext repair`, which satisfies
"a mismatch never auto-resolves" by requiring the explicit action the [option] below asked
for under the name `reseal`. The paragraph that follows is the 2026-08-13 state this
requirement was written against, kept as the reason it exists; none of it is true today.

Then: `mycontext add` wrote a bare skeleton — always:false, no scope, no body — and any
hand-edit invalidated the checksum, after which every command exited 1. Checksum
verification shipped in Plan 1 while the edit path (core/mutate.ts) belonged to Plan 3, so
the product had a lock with no key.

## Observations
- [symptom] checksum mismatch ... This file may have been edited outside my_context
- [option] A `reseal` command that recomputes checksums for deliberately edited files, satisfying "a mismatch never auto-resolves" by requiring an explicit action
- [option] Flags on `add` so a useful item can be created in one shot
