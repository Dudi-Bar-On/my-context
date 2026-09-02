---
id: TASK-the-parity-gate-needs-a-fixture-corpus-holding-one-record-of
type: task
title: the parity gate needs a fixture corpus holding one record of every kind
status: active
severity: soft
always: false
summary: Give the comparison test a fixed set of sample records, so it measures the code rather than whatever happened to occur that day.
summary_of: c3cc698087ae4202
scope: []
tags:
  - "plan:port"
  - "seq:9"
  - v2
  - ui
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 4be0e1b5bd0d14e6
plan: port
seq: "9"
state: done
---

# the parity gate needs a fixture corpus holding one record of every kind

e2e/screen-parity.spec.ts compares every screen to its mockup section by element kind. For data-driven screens the answer moves with the corpus rather than the code: the watch ledger measured 15 gaps, shrank to 8 an hour later, and rect returned on the next run because the pulse's twenty-minute window emptied. DATA_DEPENDENT currently exempts watch from the stale-entry direction, which keeps the gate honest for the other ten screens but weakens it for that one. The fix is a fixture corpus carrying at least one audit record of every kind - mutation, injection, hook, focus, access, progress - plus items in every tier, so the comparison measures the code instead of the day. e2e/app.ts already reads MYCONTEXT_E2E_CORPUS, so the hook exists; what is missing is the corpus and a decision about where it lives.
