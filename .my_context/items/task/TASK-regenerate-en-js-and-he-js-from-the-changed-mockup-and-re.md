---
id: TASK-regenerate-en-js-and-he-js-from-the-changed-mockup-and-re
type: task
title: regenerate en.js and he.js from the changed mockup, and re-run the parity test
status: active
severity: soft
always: false
summary: Rebuild both language tables from the updated design by machine rather than by hand, then re-run the check that they still match.
summary_of: 5247f81d175a0083
scope: []
tags:
  - "plan:rulings"
  - "seq:8"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 3f0150d86123b4a6
plan: rulings
seq: "8"
state: done
progress: "100"
priority: "2"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T12:19:33Z"
---

# regenerate en.js and he.js from the changed mockup, and re-run the parity test

Depends on the mockup pass. Transcribe by machine as T1 did, never by hand: the tokenizer walks every data-t, collapses span.m into {m:...} slots and lifts const HE by brace-matching. Then re-derive the key count - it is 329 today and the test derives it rather than pinning it.
