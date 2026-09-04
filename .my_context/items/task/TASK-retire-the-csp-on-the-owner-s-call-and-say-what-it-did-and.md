---
id: TASK-retire-the-csp-on-the-owner-s-call-and-say-what-it-did-and
type: task
title: retire the CSP on the owner’s call, and say what it did and did not cost
status: active
severity: soft
always: false
summary: Drop a browser security policy that was blocking live debugging, and record honestly what it protected and what it never did.
summary_of: 46d1563352f61c4d
scope: []
tags:
  - "plan:fixes"
  - "seq:1"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 0e07231a7d084b5f
plan: fixes
seq: "1"
state: done
---

# retire the CSP on the owner’s call, and say what it did and did not cost

Owner call 2026-08-22. X-Frame-Options: DENY replaces frame-ancestors, which was the framing half of the DNS-rebinding defence and had nothing to do with styling. server-e2e asserts the ABSENCE so re-adding it is deliberate. Measured, against the policy this server was still sending: el.style.setProperty was ALLOWED and setAttribute(style) was BLOCKED, so style-src never governed the CSSOM and no chart was ever going to draw at length zero. What it genuinely cost was the ability to try a fix in a live page. Landed bcef938.
