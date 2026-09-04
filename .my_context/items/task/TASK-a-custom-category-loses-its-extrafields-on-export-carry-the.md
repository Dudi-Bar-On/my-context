---
id: TASK-a-custom-category-loses-its-extrafields-on-export-carry-the
type: task
title: a custom category loses its extraFields on export - carry the whole category
status: active
severity: soft
always: false
summary: Exporting a project drops part of each custom item type's definition, so the copy describes fields it no longer carries.
summary_of: b335ca78c86b4105
scope: []
tags:
  - "plan:export"
  - "seq:18"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: fa6273a20386cab1
plan: export
seq: "18"
state: done
---

# a custom category loses its extraFields on export - carry the whole category

MEASURED 2026-08-23 by exporting this repository's own corpus. config.json ACCEPTS seven category keys; `EXPORT_KEYS` (pack/config-io.ts ~111) writes SIX. `extraFields` is dropped. `projectPackConfig` writes four and drops it too. `RawCategoryJson` does not even declare it.

THE MEASUREMENT, verbatim from the exported artefact: the `task` entry travelled with tier, prefix, agentEdits, scopePolicy and a description reading "Its plan, sequence, state and progress live in extra fields" - and carried NONE of the seven fields that sentence names. The export carries the claim and drops the thing it claims.

DO: add `extraFields` to `EXPORT_KEYS`, to `RawCategoryJson`, and to `projectPackConfig` for a category the receiver does not ship - the same predicate that already decides tier and description there.

AND ADD THE GATE, which is the part that outlives this fix: a test asserting that every key `CATEGORY_KEYS` accepts is a key a whole-workspace export writes. The two lists drifted silently once and nothing noticed; the eighth key must not be able to repeat it.

NOTE the byte-order constraint: config.json's bytes are hashed into the manifest, so key order is fixed and two exports differing only in order do not verify against each other.
