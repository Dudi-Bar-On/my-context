---
id: REQ-session-focus-controls-what-loads
type: requirement
title: A session can narrow what loads into context, disclosing what it hid
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
checksum: 2be9e7dc9300e37b
kind: functional
---

# A session can narrow what loads into context, disclosing what it hid

**Status: built 2026-08-16, and two named differences from what this item asked for.** It is
`mycontext focus` (plus `--show`, `--clear`, `--preview`, `--relations`), the `focus_context`
MCP tool, `/mycontext:focus`, and a filter applied inside `select()` — the one answer to
"what gets injected" — rather than a second selection path.

**It narrows on `tags`, `categories` and `scope`, not on domains.** This item was written to
depend on REQ-items-carry-a-domain, and that requirement was retired by
NOGOAL-no-domain-axis-on-items: domains are dropped, because scope globs, tags, categories
and SQL already slice the corpus four ways. The `depends_on` edge below still points at it
and is left standing deliberately — no supported surface removes a relation, and the edge is
not broken: it resolves to a superseded item that names its own replacement, which is the
trail a reader should be able to follow. Read it as history.

**Focus is scoped to the WORKSPACE, not to the session, and that contradicts the `[decision]`
observation below.** That observation asks for `.my_context/state/<session_id>.focus.json`.
No surface that can SET a focus has a trustworthy session id: the CLI runs in a terminal and
is handed none, and the MCP server's `CLAUDE_CODE_SESSION_ID` does not match the id the hooks
receive on a resumed session — measured in this repository, and recorded at length in
`core/inject.ts`. A session-keyed file would be written under a key the hooks never read, so
focus would appear to work and change nothing. The file is `.my_context/state/focus.json`,
which is gitignored, so a focus is local to one machine and never narrows a teammate's
injection. The `[edge_case]` observation about surviving compaction is satisfied trivially by
that choice. The observations are not edited because no surface can edit an observation —
see README section 8 — so they are corrected here instead of being left to mislead.

**Decided 2026-08-16 (plan decision Q2): focus discloses and allows.** It hides exactly what
it was asked to hide and reports the cost — "N items hidden by focus, M load-bearing
relations now dangling". It never refuses to do what the user asked. That settles
OPENQ-how-do-filters-respect-dependencies, which is superseded by
DEC-focus-discloses-and-allows-rather-than-refusing-to-hide.

**The `[rule]` observations are both honoured.** Whatever focus hides is disclosed the way
spill is, in the injected block itself and not only in a command's output; and focus never
hides a `severity: hard` item, with the count of hard items kept for that reason reported
alongside. The `[option]` preview exists as `mycontext focus --preview`, and it calls
`select` with the candidate focus rather than re-deriving the predicate, so a preview and the
injection that follows it cannot disagree.

**What remains unmet: nothing in this item's text, and one thing in its spirit.** Focus
governs future injection only. It cannot retract text already in the window — the
`[constraint]` observation says so and it is still true.

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
