---
id: INV-hooks-fail-open
type: invariant
title: Hooks fail open, always
status: active
severity: hard
always: false
summary: When anything goes wrong the hooks say nothing and let the session carry on, because breaking someone's work is worse than telling them nothing.
summary_of: 072adad2db5459f8
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
checksum: 8463c6bfb0ac7f80
---

# Hooks fail open, always

Any error yields empty output and exit 0. A knowledge base that breaks the user’s
session is worse than one that says nothing. This holds for a missing workspace, a
corrupt config, an unreadable database, and a malformed item file.

## Observations
- [invariant] A hook never throws and never leaves a Store handle open
- [exception] The .my_context/ write-deny in Plan 2 is the single deliberate exception
- [limit] PreToolUse/JIT is held to p95 under 50ms; SessionStart to 500ms #performance
- [limit] SubagentStart is held to p95 under 500ms and blocks every dispatch; nothing in-process bounds it #performance
