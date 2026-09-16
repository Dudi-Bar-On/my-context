---
id: TASK-replaying-the-store-changelog-from-empty-yields-eleven
type: task
title: replaying the store changelog from empty yields eleven entries against a store of twelve
status: active
severity: soft
always: false
summary: Replaying the store's change history from empty produces one entry fewer than the store holds; it was confirmed still true and left alone.
summary_of: 1bbd09f843325ee1
summary_was:
  - 2026-09-16 The list of changes to the shipped rules does not add up to the rules that are actually there, because one of them was never recorded as added.
scope:
  - src/rules/**
tags:
  - v2
  - store
  - changelog
  - "plan:store"
  - "seq:10"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 97bcc6db6e709e8e
plan: store
seq: "10"
state: todo
priority: "3"
---

# replaying the store changelog from empty yields eleven entries against a store of twelve

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, S7) as row 80 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Replaying the store's own changelog from empty yields 11 entries against a store that holds 12. The missing one is `numbered-options-on-a-question-put-to-the-owner`: it appears under `changed` in v1 and in NO `added` list, ever.

WHY IT IS WORTH AN ITEM AT MINOR. The changelog is the store's account of how it got to its current state, and it does not reconstruct that state. One entry arrived without ever being added. The defect is small; what it tells you about the changelog's reliability as a record is not.

THE CHECK THAT WOULD HAVE CAUGHT IT is the replay itself -- reconstruct from the changelog and compare with the manifest.

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN 374f4e0a — named as STILL OPEN AND NOT TAKEN by the lane that was in these files — the changelog is one version behind

That commit was in the store's fixtures and said in as many words what it did NOT take: `doctor` never walks the entries directory (another lane's file), nothing runs `rules verify` as a gate (which is D71's), and THE CHANGELOG IS ONE VERSION BEHIND, which is this item. Nothing here was changed.

Recorded so the next reader does not mistake a lane working nearby for a lane working on this.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`.
