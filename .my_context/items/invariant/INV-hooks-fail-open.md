---
id: INV-hooks-fail-open
type: invariant
title: Hooks fail open, always
status: active
severity: hard
always: false
scope:
  - src/hooks/**
tags:
  - reliability
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 0bd466483128fc3a
---

# Hooks fail open, always

Any error yields empty output and exit 0. A knowledge base that breaks the user’s
session is worse than one that says nothing. This holds for a missing workspace, a
corrupt config, an unreadable database, and a malformed item file.

## Observations
- [invariant] A hook never throws and never leaves a Store handle open
- [exception] The .my_context/ write-deny in Plan 2 is the single deliberate exception
- [limit] PreToolUse/JIT is held to p95 under 50ms; SessionStart to 500ms #performance
