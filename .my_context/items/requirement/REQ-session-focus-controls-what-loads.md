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
checksum: d14d677e3d7d9987
kind: functional
---

# A session can focus on domains, controlling what loads into context

**Status: scheduled, not built. Nothing in this repository implements it today.** It is
recorded here as a `hard` requirement so it keeps governing the design it constrains; it is
not a description of behaviour that exists. `focus`, `focus --exclude`, `focus --clear`,
`focus --show` and a filtered `/LoadMyContext` are all unbuilt, and no MCP tool mirrors them.

While working on one area, knowledge from unrelated areas is noise that costs context the
user needs for their own work. A session must be able to narrow what my_context injects, and
every command must be mirrored as an MCP tool so Claude can narrow its own context too.

**Decided 2026-08-16 (plan decision Q2): focus discloses and allows.** It hides exactly what
it was asked to hide and reports the cost — "N items hidden, M load-bearing relations
dangling". It never silently produces a corpus that contradicts itself, and it never refuses
to do what the user asked. That settles OPENQ-how-do-filters-respect-dependencies for this
requirement: an item may be hidden even when a visible item `blocks` or `depends_on` it, and
the count of such relations is reported rather than the hide being refused.

**What it narrows on is no longer domains.** This item was written to depend on
REQ-items-carry-a-domain, and that requirement was retired on the same day by
NOGOAL-no-domain-axis-on-items: domains are dropped, because scope globs, tags, categories
and SQL already slice the corpus four ways. The `depends_on` edge below still points at
REQ-items-carry-a-domain and is left standing deliberately — no supported surface removes a
relation, and the edge is not broken: it resolves to a superseded item that names its own
replacement, which is the trail a reader should be able to follow. Read it as history. The
axes focus narrows on are the ones that exist: `tags`, `scope` and `category`.

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
