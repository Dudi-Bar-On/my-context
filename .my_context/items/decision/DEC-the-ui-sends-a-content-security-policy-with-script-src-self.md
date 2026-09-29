---
id: DEC-the-ui-sends-a-content-security-policy-with-script-src-self
type: decision
title: the UI sends a Content-Security-Policy with script-src self
status: active
severity: soft
always: false
summary: The local console now tells the browser to run only its own scripts and load only its own resources, and a browser test proves every screen that runs a command still runs it under that rule.
summary_of: 3c6c3dedb9ff9fcd
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: ed9680946bf1012a
---

# the UI sends a Content-Security-Policy with script-src self

Owner ruling E, 2026-09-21, for release 2.0.0; landed by task 3.8 in commit 016483a4. Every response the console serves carries content-security-policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' (SECURITY_HEADERS in src/ui/security.ts, spread by every sender). The 2026-08-22 suspension is kept as history in the same file. What proves it: test/ui/server-e2e.test.ts asserts the exact value, and e2e/csp-executes.spec.ts drives a command from the Composer, the palette catalogue with an argument, Capture and Configure to a server-side execute-done audit row with zero policy violations, having first passed on the baseline without the header. style-src keeps 'unsafe-inline' because the screens set styles through the CSSOM and the mockup's own inline attributes are forbidden by parts.js already; img-src keeps data: because the ruling named it, although nothing in src/ui/public loads a data: image today - narrowing it is a separate, provable change. Supersedes TASK-no-content-security-policy-header-and-no-meta-on-a-local.

## Relations
- supersedes [[TASK-no-content-security-policy-header-and-no-meta-on-a-local]]
