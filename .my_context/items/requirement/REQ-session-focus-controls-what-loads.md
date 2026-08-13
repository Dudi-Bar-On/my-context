---
id: REQ-session-focus-controls-what-loads
type: requirement
title: A session can focus on domains, controlling what loads into context
status: active
severity: hard
always: false
scope:
  - src/cli/**
  - src/hooks/**
  - src/mcp/**
  - src/core/select.ts
tags:
  - cli
  - context-control
  - roadmap
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: f6312c3b18b76247
kind: functional
---

# A session can focus on domains, controlling what loads into context

While working on one area, knowledge from unrelated domains is noise that costs
context the user needs for their own work. A session must be able to narrow what
my_context injects: `focus <domain...>`, `focus --exclude <domain...>`, `focus --clear`,
`focus --show`, and a `/LoadMyContext [domain...]` that re-injects under the filter.
Every command is mirrored as an MCP tool so Claude can narrow its own context too.

Depends on [[REQ-items-carry-a-domain]].

## Observations
- [constraint] Injected text cannot be retracted. Focus governs FUTURE injection — JIT activation, the next session start, and post-compaction restore. It never removes what is already in the window
- [fact] Compaction is the natural reload point: the window clears and SessionStart(compact) re-injects, so "reload excluding X" genuinely takes effect there
- [decision] Focus is session state, not config. It lives in .my_context/state/<session_id>.focus.json, reusing the pattern the restore snapshot already established — config.json is per-project and committed, and a temporary narrowing must not edit a committed file
- [rule] Whatever focus hides MUST be disclosed the way spill is — "N items hidden by focus" — or focus becomes a way to silently drop knowledge, which is the one unacceptable failure in this project
- [rule] Focus never hides a severity:hard item. Narrowing is for noise reduction, not for suppressing what must always hold
- [option] A `preview [--domain X]` command showing what WOULD be injected without injecting it. Nearly free because select is a pure function, and it lets scopes, domains and budgets be tuned without starting sessions
- [edge_case] The focus file is keyed on session id, so it must survive compaction — a compact event continues the same session

## Relations
- depends_on [[REQ-items-carry-a-domain]]
- constrains [[INV-nothing-is-dropped-silently]]
