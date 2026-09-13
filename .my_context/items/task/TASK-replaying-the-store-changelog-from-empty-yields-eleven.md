---
id: TASK-replaying-the-store-changelog-from-empty-yields-eleven
type: task
title: replaying the store changelog from empty yields eleven entries against a store of twelve
status: active
severity: soft
always: false
summary: The list of changes to the shipped rules does not add up to the rules that are actually there, because one of them was never recorded as added.
summary_of: 4e4fb7d103ab2f0a
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
checksum: e2c516192a528cda
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
