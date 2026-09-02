---
id: TASK-config-unknown-top-level-keys-warn-and-are-skipped-add-the
type: task
title: "config: unknown top-level keys warn and are skipped; add the ui key"
status: active
severity: soft
always: false
summary: An unrecognised setting should be reported and skipped rather than rejecting the whole file, which today can switch the tool off entirely.
summary_of: 28fc55d728e0d6fc
scope: []
tags:
  - "plan:rulings"
  - "seq:19"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 4925a96de8b35b70
plan: rulings
seq: "19"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T17:09:50Z"
---

# config: unknown top-level keys warn and are skipped; add the ui key

Rulings R14.2 and R14.3, both in src/core/config.ts.

Today an unrecognised top-level key means the WHOLE config is refused - Nothing was loaded. So a config carrying ui would disable the entire plugin on any build predating the key, which breaks R14's own third clause. Change the contract: an unknown TOP-LEVEL key is DISCLOSED and skipped. Unknown keys INSIDE a known block keep refusing outright, so category and budget typos still fail loudly.

This is the general problem and ui is only its first instance - every future top-level key had it.

Then add the ui key itself. TOP_LEVEL_KEYS is currently profile, categories, budgets, watchedDocs. The UI is ENABLED when the key is absent, so the schema must express opt-out rather than opt-in, and absence must not be confused with disabled.

INV-nothing-is-dropped-silently applies to the skip: a key that is ignored must SAY it was ignored, on a channel someone reads.
