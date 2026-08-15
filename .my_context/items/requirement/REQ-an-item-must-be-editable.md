---
id: REQ-an-item-must-be-editable
type: requirement
title: There must be a supported way to edit an item
status: active
severity: hard
always: false
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
checksum: 8831174dd0d523a0
kind: functional
---

# There must be a supported way to edit an item

Today `mycontext add` writes a bare skeleton — always:false, no scope, no body —
and any hand-edit invalidates the checksum, after which every command exits 1.
Checksum verification shipped in Plan 1 while the edit path (core/mutate.ts) belongs
to Plan 3, so the product currently has a lock with no key.

## Observations
- [symptom] checksum mismatch ... This file may have been edited outside my_context
- [option] A `reseal` command that recomputes checksums for deliberately edited files, satisfying "a mismatch never auto-resolves" by requiring an explicit action
- [option] Flags on `add` so a useful item can be created in one shot

## Relations
- discovered_by [[LESSON-dogfooding-found-the-missing-edit-path]]
