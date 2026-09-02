---
id: KNOWN-a-token-submitted-as-the-host-header-is-recorded-in-the
type: known_issue
title: a token submitted as the Host header is recorded in the audit log
status: active
severity: soft
always: false
summary: A secret that arrives in an unexpected place is written into a permanent log, because the part that records it has no way to recognise it.
summary_of: fbca631b2079774a
scope: []
tags:
  - v2
  - audit
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 41248e20e15fcb58
---

# a token submitted as the Host header is recorded in the audit log

Field rule 5 says the token is never recorded in any form. Field rule 2 says host and origin are recorded as submitted. When the value submitted in Host IS the token, rule 2 wins: recordRefusal is never given the token and cannot recognise it.

Not mitigated, deliberately. The only fix passes the secret into the writer, which is worse. Pinned by a test named 'B4 LIMIT: a token submitted as the Host IS recorded', so it cannot quietly stop being true.

A sender who can put the token in a header already has it. What the finding costs is narrower: it puts the secret in a file that outlives the process, which is what rule 5 objects to.

## Observations
- [note] verified by an implementing agent during v2.0; recorded in reports/2026-08-21-FINDINGS.md entry 4
