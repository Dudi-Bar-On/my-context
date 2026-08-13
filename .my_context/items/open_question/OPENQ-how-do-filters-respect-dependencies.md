---
id: OPENQ-how-do-filters-respect-dependencies
type: open_question
title: When a filter excludes an item something else depends on, what happens?
status: active
severity: hard
always: false
scope:
  - src/core/select.ts
  - src/cli/**
tags:
  - context-control
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 787a19d31b3d3576
---

# When a filter excludes an item something else depends on, what happens?

Session filters will narrow injection by domain, category and status. But items are
related, and excluding one can make another misleading rather than merely absent.

Excluding `lesson` is harmless — a rule that says `derived_from LESSON-x` still stands
on its own. Excluding `open_question` is not: an `OPENQ` that `blocks REQ-y` is the
only thing telling Claude not to start REQ-y. Hide it and Claude confidently begins
work on something deliberately blocked.

DESIGN THIS BEFORE IMPLEMENTING. Do not ship filters that can silently orphan a
load-bearing relation.

## Observations
- [unknown] Which relation types are load-bearing (blocks, depends_on, constrains, enforces) versus merely referential (derived_from, links_to, discovered_by, supersedes)
- [option] Classify relation types, then compute a closure: an item is included if selected OR if a selected item points at it through a load-bearing relation. Risk: the closure can pull in far more than the user asked for, and it silently overrides an explicit exclusion
- [option] Do not override — warn. Allow any exclusion, and disclose every dangling load-bearing relation: "OPENQ-x is hidden by your filter and blocks REQ-y, which is included." Consistent with the project rule that whatever is hidden is disclosed, and needs no resolution policy
- [fact] Status filtering already partly exists: retired statuses are excluded by the eligibility gate, so "exclude answered open questions" is the default behaviour today — an answered question is superseded and never injected
- [rule] Whatever a filter hides must be disclosed, the same way spill is. A filter is not permission to drop knowledge quietly
- [method] A preview command makes this tractable: show what a filter would include, exclude, and orphan, before committing to it

## Relations
- blocks [[REQ-session-focus-controls-what-loads]]
- constrains [[INV-nothing-is-dropped-silently]]
