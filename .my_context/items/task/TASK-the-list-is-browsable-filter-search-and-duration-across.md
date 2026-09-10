---
id: TASK-the-list-is-browsable-filter-search-and-duration-across
type: task
title: "the list is browsable: filter, search and duration, across sessions"
status: active
severity: soft
always: false
summary: Finding the session you want among many, by when it was, which branch it was on, or what was said in it.
summary_of: f1e86a479a58339c
scope:
  - src/ui/**
  - src/core/conversation-index.ts
  - e2e/**
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:10"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 2107e99276a68a05
plan: archive
seq: "10"
state: done
priority: "2"
verified_on: 2026-09-10
---

# the list is browsable: filter, search and duration, across sessions

Carries out REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a clause 4, "a BROWSER that would allow to look at DIFFERENT SESSIONS", and the
design spec "Filterable by date and branch, searchable across content".

NONE OF IT EXISTS. drawList has no filter control at all, and /api/conversations accepts limit and
offset ONLY - it actively REFUSES any other parameter, so this cannot be added client-side and the
endpoint must move first. The single filter box on the screen today lives INSIDE the transcript and
matches only the 50 records that were loaded.

ALSO MISSING FROM THE ROW, both defined: DURATION in the list (the spec names it in the column list,
and startedAt/endedAt are both already in the row, so this is arithmetic), and durationMs in the
transcript, which appears nowhere in the index, the endpoint or the screen.

AND THE TITLE OVERRIDE, defined and absent: the spec says the title is taken from the transcript own
aiTitle "AND OVERRIDABLE for a session worth naming". my_context provides no override anywhere - not
in the CLI, not on the screen. What exists is Claude Code own rename, borrowed. Decide whether to
build the override or to record that the harness owns naming; either is defensible, but the current
silence is not.
