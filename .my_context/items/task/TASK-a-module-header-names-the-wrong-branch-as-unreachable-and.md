---
id: TASK-a-module-header-names-the-wrong-branch-as-unreachable-and
type: task
title: a module header names the wrong branch as unreachable, and the behaviour it describes is the correct one
status: active
severity: soft
always: false
summary: A comment at the top of a file says the opposite of what the code does, so the next reader is set up to change the part that is right.
summary_of: d72e48d433bb0cef
scope:
  - src/mcp/**
tags:
  - v2
  - mcp
  - comment-drift
  - "plan:mcpsurface"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 0cd62100c1b72853
plan: mcpsurface
seq: "4"
state: todo
priority: "3"
---

# a module header names the wrong branch as unreachable, and the behaviour it describes is the correct one

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, M3) as row 83 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `ERROR_UNSUPPORTED_VERSION` is unreachable through `initialize`, which reads `params.protocolVersion` rather than `params._meta`. Observed: a request for `2099-01-01` is answered `2026-07-28`.

AND THAT BEHAVIOUR IS SPEC-CONFORMANT. Answering with the server's own version rather than refusing is correct. SO THE DEFECT IS NOT THE CODE -- it is the module header, which claims the OPPOSITE branch is the unreachable one. A comment that inverts which branch is dead is a trap for the next reader, and the next reader is likely to "fix" the wrong thing.

THE SUBJECT. The MCP surface has to declare what it does truthfully, and that includes what it says about itself in its own header.
