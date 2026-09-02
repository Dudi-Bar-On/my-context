---
id: TASK-ruling-11-security-refusal-reasons-become-developer-facing
type: task
title: "ruling 11: security refusal reasons become developer-facing and stop echoing submitted input"
status: active
severity: soft
always: false
summary: Refusal messages should name the check that refused instead of repeating back whatever the caller sent.
summary_of: 1b271b838e14198e
scope: []
tags:
  - "plan:rulings"
  - "seq:4"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: dd8e9ccddb7117e4
plan: rulings
seq: "4"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T11:38:07Z"
---

# ruling 11: security refusal reasons become developer-facing and stop echoing submitted input

Fixed strings naming the check that refused. Do NOT reflect the attacker-supplied Host or Origin back in the response body. Never rendered, so no string-table entry. Not an XSS vector under the strict CSP - the echo simply serves no purpose. The submitted value may go to the audit record instead.
