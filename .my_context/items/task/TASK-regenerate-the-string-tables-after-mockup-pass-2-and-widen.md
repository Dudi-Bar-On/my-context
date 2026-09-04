---
id: TASK-regenerate-the-string-tables-after-mockup-pass-2-and-widen
type: task
title: regenerate the string tables after mockup pass 2, and widen the parity test for data-t-title
status: active
severity: soft
always: false
summary: Rebuild both language tables after the next design pass, and widen the matching check to cover a kind of label it currently ignores.
summary_of: 9b88177dc5dca02e
scope: []
tags:
  - "plan:rulings"
  - "seq:15"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: c33d2c79665cb298
plan: rulings
seq: "15"
state: done
progress: "100"
priority: "2"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T18:05:55Z"
---

# regenerate the string tables after mockup pass 2, and widen the parity test for data-t-title

Depends on mockup pass 2. Transcribe by machine, never by hand: the tokenizer walks every data-t, data-t-aria and the new data-t-title, reduces {v:name=sample} to {name}, {mv:name=sample} to {mv:name} and the new {b:name=sample} to {b:name}, keeps {m:text} whole, then an INDEPENDENT verify pass reloads the shipped modules and diffs every value back.

Widen mockupKeys() for data-t-title the way it was widened for data-t-aria. That regex has already been a blind spot once: it read data-t= only, so ten aria keys were droppable from EITHER side with nothing to notice, and a claim of exact parity was unverifiable.

The key count is DERIVED, never pinned. It was 326, then 329, then 351.
