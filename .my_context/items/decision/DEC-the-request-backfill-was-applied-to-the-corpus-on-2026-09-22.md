---
id: DEC-the-request-backfill-was-applied-to-the-corpus-on-2026-09-22
type: decision
title: the request backfill was applied to the corpus on 2026-09-22, after the source repair and committed alone
status: active
severity: soft
always: false
summary: The script that writes the original request of the owner into each item it produced was run for real once, after the corpus repair it depended on, in its own commit.
summary_of: b6f68b0c86563d20
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: ac898e31da0cfbae
---

# the request backfill was applied to the corpus on 2026-09-22, after the source repair and committed alone

Owner ruling, 2026-09-21, recorded in release phase 2 on 2026-09-22 (runbook 7.3, ruling G). The owner authorised node scripts/backfill-requests.ts .my_context --apply after the B1 repair, committed alone. Run 2026-09-22 in commit 7a16c54f: 29 of 1344 items filled, 1315 skipped with a reason each. Cites TASK-scripts-backfill-requests-ts-exists-and-was-measured-against.

## Relations
- relates_to [[TASK-scripts-backfill-requests-ts-exists-and-was-measured-against]]
