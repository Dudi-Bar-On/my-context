---
id: REQ-plan-2-precision-injection
type: requirement
title: Injection must survive compaction and activate by scope
status: active
severity: soft
always: false
summary: "Handing knowledge over once at the start is not enough: it must also arrive when the relevant files are touched, and return after a conversation is trimmed."
summary_of: 08d3f3f5cf7774fa
scope:
  - src/hooks/**
  - src/core/select.ts
tags:
  - roadmap
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: b832ca5ca7f58eb0
kind: functional
---

# Injection must survive compaction and activate by scope

Session-start injection alone is not the product. JIT activation via PreToolUse and
a PreCompact snapshot restored at SessionStart(compact) are what make it precise
rather than merely present. Surviving compaction was the original motivating problem.
