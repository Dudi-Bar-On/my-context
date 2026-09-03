---
id: LESSON-alphabetical-id-became-the-priority
type: lesson
title: "When everything is severity:hard, the id tie-break silently becomes the priority"
status: active
severity: soft
always: false
summary: When everything is marked equally important, an arbitrary tie-breaker silently decides what survives, and alphabetical order is not a judgement of value.
summary_of: d0e13e9a2bfa9706
scope: []
tags:
  - selector
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: b5c0eaaa9ce130f9
---

# When everything is severity:hard, the id tie-break silently becomes the priority

The first real corpus pinned 16 items, all `severity: hard`, and blew the 1500-token
budget. `byPriority` sorts by severity, then layer, then id — so with severity and
layer tied for everything, alphabetical id decided what survived. `CONST-*` and
`INV-*` won; `OPENQ-*`, `REQ-*` and `RULE-*` lost. The item that spilled included the
open question blocking all of Plan 2 — dropped because "O" sorts after "I".

## Observations
- [cause] An id tie-break exists for determinism, not for ranking, but it ranks whenever the real signals tie
- [cause] Two severity levels cannot separate a large corpus; a mostly-hard corpus degenerates to alphabetical
- [option] More severity levels, or an explicit order field on pinned items
- [option] Keep the pinned set genuinely small — the authoring error here was pinning 16 things, not the sort
- [method] Spill disclosure is what made this visible at all; it named every dropped item and its tier #testing

## Relations
- discovered_by [[LESSON-dogfooding-found-the-missing-edit-path]]
