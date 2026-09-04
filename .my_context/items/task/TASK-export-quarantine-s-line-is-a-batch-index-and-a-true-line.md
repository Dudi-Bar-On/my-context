---
id: TASK-export-quarantine-s-line-is-a-batch-index-and-a-true-line
type: task
title: "export: quarantine's line is a batch index, and a true line number needs HistoryRead widened"
status: active
severity: soft
always: false
summary: A number presented as a line in a file is really a position within a batch, so anyone who counts to it lands somewhere else entirely.
summary_of: e556c2a62128f3ac
scope: []
tags:
  - "plan:export"
  - "seq:11l"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 3ef4e5c75b483e4b
plan: export
seq: 11l
state: done
priority: "2"
---

# export: quarantine's line is a batch index, and a true line number needs HistoryRead widened

Found building src/pack/imported-audit.ts. The plan's byte layout shows "line":42 for a row out of a 41-record history, which reads as a physical line in history.jsonl. parseHistory returns unknown: JsonlRow[] with no line numbers, so the only number available is the row's position in the batch - and the plan's own test in the same section asserts line === 1, which is the batch index. The sample and the test disagree about what the field means.

Shipped as the batch index, documented on the field. A true file line number needs HistoryRead.unknown widened to carry one, which is this task.

Until then a reader who opens history.jsonl and counts to the quarantined line will land somewhere else, which is the kind of number that is worse than none.
