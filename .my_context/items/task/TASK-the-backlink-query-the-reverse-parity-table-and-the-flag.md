---
id: TASK-the-backlink-query-the-reverse-parity-table-and-the-flag
type: task
title: the backlink query, the reverse parity table and the flag reference
status: active
severity: soft
always: false
summary: "Three board capabilities shipped together: what points at an item, which commands have no tool, and what every flag takes."
summary_of: bef5169d2e106985
acknowledged:
  - state_unaudited@b718f572851c28ec
scope: []
tags:
  - v2
  - backfill
  - "plan:rulings"
  - "seq:21"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 2f3cc8d269d0a236
plan: rulings
seq: "21"
state: done
verified_on: 2026-09-04
priority: "3"
---

# the backlink query, the reverse parity table and the flag reference

search and query_items gained --linked-to with --direction in|out|both, defaulting to both. CLI_WITHOUT_TOOL was added, derived on both sides, finding 28 commands with no tool of which 17 were intended. A 135-row flag table now renders from FLAG_DECLARATIONS and refuses to render when a flag is undocumented. Shipped in 2143868.
