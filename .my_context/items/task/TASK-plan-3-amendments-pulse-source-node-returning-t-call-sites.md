---
id: TASK-plan-3-amendments-pulse-source-node-returning-t-call-sites
type: task
title: "plan 3 amendments: pulse source, node-returning t() call sites, the stale withStores signature"
status: active
severity: soft
always: false
summary: "Three corrections to a plan: where the activity chart gets its numbers, fifty places that misuse translated text, and a stale quoted signature."
summary_of: 779973a34c0cde17
scope: []
tags:
  - "plan:rulings"
  - "seq:17"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: ab31e1afc18cd415
plan: rulings
seq: "17"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T17:09:50Z"
---

# plan 3 amendments: pulse source, node-returning t() call sites, the stale withStores signature

ONE task because all three edit docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md.

A2 - /api/watch/volume changes source from ledger.history() to the audit table. The mockup says the pulse is coloured by RECORD KIND from audit.at; ledger.history() has no kind, and being one row per (session, item, tier) it undercounts repeat injections exactly as history()'s corrected docstring warns.
A1 - about fifty call sites consume t() as a string (.textContent = t(...), template concatenation). Both flatten an isolated element. One was already converted during the mv fix; the rest follow.
STALE - line ~1609 quotes withStores<T>(ws, fn: (store: Store, ledger: Ledger) => T): T verbatim and instructs an implementer to rely on it. The ledger is now Ledger | null and line ~1809 destructures it.
