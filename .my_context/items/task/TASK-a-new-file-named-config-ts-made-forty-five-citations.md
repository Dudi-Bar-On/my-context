---
id: TASK-a-new-file-named-config-ts-made-forty-five-citations
type: task
title: a new file named config.ts made forty-five citations ambiguous
status: active
severity: soft
always: false
summary: Adding a second file with an existing name left every citation naming it unable to resolve.
summary_of: 93c74af9cbbc5ba4
acknowledged:
  - state_unaudited@222335ea65a486ac
scope: []
tags:
  - v2
  - backfill
  - "plan:walk"
  - "seq:137"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 29ff1e7502985cc4
plan: walk
seq: "137"
state: done
verified_on: 2026-09-04
priority: "3"
---

# a new file named config.ts made forty-five citations ambiguous

Citations naming a bare config.ts stopped resolving when src/cli/commands/config.ts landed beside src/core/config.ts. Fifteen in source were disambiguated to core/config.ts and thirty in plan documents reworded on the owner instruction. Ambiguous returned to zero and the fault count to its standing value. Shipped in 971534f.
