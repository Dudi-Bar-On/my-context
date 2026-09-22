---
id: RULE-a-handover-line-that-is-actionable-names-an-item-id-and-a
type: rule
title: a handover line that is actionable names an item id, and a copy of a rule is never the rule
status: active
severity: hard
always: false
summary: Instructions passed between working sessions point at the single recorded item rather than repeating its words, so a change to the item reaches everyone and a stale copy cannot be acted on.
summary_of: 9cb6eef83daba77a
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 41c69b2e0797e5d7
---

# a handover line that is actionable names an item id, and a copy of a rule is never the rule

Owner ruling, 2026-09-21, recorded in release phase 2 on 2026-09-22 (runbook 7.3, ruling G). handover/16 asked whether the pointer convention becomes a rule. It does. A line in a handover that asks for an act names the item id that governs it; it does not restate the rule. A restated rule cannot be superseded - only the original can - and a session acting on a copy acts on whatever the copy said when it was written. This is the defect the project measured on 2026-09-07: two boards each claiming to be the single place, and five superseded instructions acted on as current. Enforced by check:handover for the dangling tier. Cites TASK-an-actionable-line-in-the-handover-names-an-item-and-the.

## Relations
- relates_to [[TASK-an-actionable-line-in-the-handover-names-an-item-and-the]]
