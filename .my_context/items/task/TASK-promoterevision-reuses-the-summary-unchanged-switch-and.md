---
id: TASK-promoterevision-reuses-the-summary-unchanged-switch-and
type: task
title: promoteRevision reuses the summary-unchanged switch and thereby tells updateItem the meaning held, even when the item has no summary
status: active
severity: soft
always: false
summary: When an approved revision is applied to an item that never had a one-line summary, the write reuses a flag meant to say the summary still fits, and a nearby check that depends on that flag is skipped for exactly the items it was written to catch.
summary_of: fa58f90f61b66a53
scope: []
tags:
  - "plan:release"
  - "seq:22"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: aea25ec00511c58b
plan: release
seq: "22"
state: todo
---

# promoteRevision reuses the summary-unchanged switch and thereby tells updateItem the meaning held, even when the item has no summary

Found by lane 3.11 on 2026-09-22 (release phase 3) while making promoteRevision record SUMMARY_OMITTED_NOTE. In src/core/mutate.ts, updateItem sets meaningHeld = true when summaryUnchanged is true, with no item.summary !== null guard at that call site, while two sibling guards nearby carry the guard. promoteRevision (src/core/revision.ts) now passes summaryUnchanged: true to obtain the audit note, so for a contradiction-scoped, governing item with NO summary whose content genuinely changes, the meaning-held path runs where it should not. Narrow and pre-existing in shape; reachable only through that combination. Closing condition: updateItem's meaningHeld is set only when the item has a summary (the guard the siblings carry), a test drives a summary-less governing item through promoteRevision with changed content and asserts the meaning-held path does not run while SUMMARY_OMITTED_NOTE is still recorded, and promoteRevision stops borrowing summaryUnchanged for a different purpose if a cleaner signal exists (say which). Files: src/core/mutate.ts, src/core/revision.ts, test/core/revision-summary-omitted.test.ts. Release phase 4 (silent failures), same lane group as rulings/80 and swallow/9.
