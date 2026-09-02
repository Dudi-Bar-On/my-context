---
id: TASK-ruling-1-teach-verify-citations-to-tell-a-historical
type: task
title: "ruling 1: teach verify-citations to tell a historical quotation from a stale pointer"
status: active
severity: soft
always: false
summary: Teach the reference checker to tell a deliberate quotation of old text from a pointer that has gone stale, and fix the stale ones.
summary_of: 873e8c980907a833
scope: []
tags:
  - "plan:rulings"
  - "seq:1"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 100adf1c39688920
plan: rulings
seq: "1"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T11:40:53Z"
---

# ruling 1: teach verify-citations to tell a historical quotation from a stale pointer

Re-anchor the 5 stale core/revision.ts pointers in web-ui-1, web-ui-2 and export-packs. LEAVE the 16 in the categories plan - they quote pre-change text deliberately. Add a marker so the script stops flagging intentional quotations, and prove the marker red before trusting it. verify:citations stays a release gate (.github/workflows/release.yml:52).
