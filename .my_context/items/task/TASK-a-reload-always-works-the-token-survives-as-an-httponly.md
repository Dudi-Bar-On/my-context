---
id: TASK-a-reload-always-works-the-token-survives-as-an-httponly
type: task
title: "a reload always works: the token survives as an HttpOnly cookie"
status: active
severity: soft
always: false
summary: Reloading the local page no longer falsely claims the server has quit, because the sign-in now survives in a cookie that scripts cannot read.
summary_of: 199bd7a2882bd154
scope: []
tags:
  - "plan:fixes"
  - "seq:2"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: bc50ea6426c388d7
plan: fixes
seq: "2"
state: done
---

# a reload always works: the token survives as an HttpOnly cookie

The handoff nonce is one-shot and its fragment is erased on first load, so the second load had nothing to present and the page said the server had exited, which was false. /api/handoff now also returns mycontext_token, HttpOnly and SameSite=Strict, and the gate accepts header OR cookie. Tighter than the sessionStorage copy it replaces: script cannot read an HttpOnly cookie, and this page renders agent-authored bodies. Landed fb5f0fc.
