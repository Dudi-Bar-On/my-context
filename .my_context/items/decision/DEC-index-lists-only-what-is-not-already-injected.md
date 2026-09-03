---
id: DEC-index-lists-only-what-is-not-already-injected
type: decision
title: The index lists only items not already injected in full
status: active
severity: soft
always: false
summary: The short list of what else exists names only things you were not already handed, so the little room there is goes to what you cannot see.
summary_of: 98b16aac328d0aa7
scope:
  - src/core/select.ts
  - src/core/render.ts
tags:
  - selector
  - budget
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 4fe8d818ae645a9c
---

# The index lists only items not already injected in full

The index is a table of contents for what Claude does NOT already have. An item
injected in full needs no advertising — the complete rule is already present — so
listing it again spends index budget on redundancy and pushes genuinely unseen items
behind the `+N more` line.

Measured on the real corpus before the change: 8 of 19 index lines named items that
were already present in full, while 11 items Claude could not see were hidden.

## Observations
- [rule] buildIndex excludes items present in the selection’s full entries from the enumerated normative listing
- [rule] Those items do not count toward `truncated` — they were omitted as redundant, not truncated for budget
- [rule] Per-category counts for rationale items are unaffected; only the normative listing changes
- [consequence] An item in full can no longer produce an index-tier spill, so the question of whether to suppress such a record becomes moot rather than needing a rule
- [history] Surfaced when the restored tier made two tiers run on one event: an item could spill from pinned and be admitted by restored, landing in both full and spilled — output that misreported its own contents

## Relations
- constrains [[INV-nothing-is-dropped-silently]]
