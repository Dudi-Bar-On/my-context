---
id: TASK-no-content-security-policy-header-and-no-meta-on-a-local
type: task
title: no Content-Security-Policy header and no meta, on a local server that composes and executes shell commands
status: active
severity: soft
always: false
summary: The local web page declares no restriction on what it is allowed to load, which is cheap insurance for a tool that can run commands.
summary_of: abc85beab72084ec
scope:
  - src/ui/server.ts
  - src/ui/public/index.html
tags:
  - v2
  - ui
  - security
  - csp
  - "plan:rulings"
  - "seq:84"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 0f0614edc80d3708
plan: rulings
seq: "84"
state: todo
priority: "3"
---

# no Content-Security-Policy header and no meta, on a local server that composes and executes shell commands

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`, 1.3) as row 99 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. There is no `Content-Security-Policy` header and no CSP `<meta>` element. `x-content-type-options: nosniff` IS set.

AND THE HONEST FRAMING, WHICH THE REPORT INSISTS ON. This is NOT a live vulnerability: nothing on the page loads cross-origin, and report 3 verified binding by binding that the serving path holds its no-writes guarantee. It is cheap insurance for a local server that composes and executes shell commands.

THE SUBJECT. D58 is the UI being present and changing nothing. A CSP is the declaration of that property in a form a browser enforces rather than a property the code happens to have.
