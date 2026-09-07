---
id: TASK-a-new-test-declares-what-it-rests-on-and-the-gate-accepts
type: task
title: a new test declares what it rests on, and the gate accepts none with a reason
status: active
severity: soft
always: false
summary: New tests must say which rules they assume, or say plainly that they assume none and why.
summary_of: 6c30fc9aa568b8d2
scope:
  - test/**
  - e2e/**
  - scripts/**
  - src/core/**
tags:
  - v2
  - testing
  - governance
  - "plan:basis"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 8a85ff1b2482826a
plan: basis
seq: "2"
state: todo
priority: "2"
needs: basis/1
---

# a new test declares what it rests on, and the gate accepts none with a reason

Owner ruling 2026-09-07. The rule is RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
(pinned, severity hard). Read it before building; it carries the reasoning and the limit.

THE GATE: a test file must carry a `@basis` declaration. Either one or more item ids, or the literal
`none` FOLLOWED BY A REASON. A bare `none` with no reason does not pass.

THE ID HALF IS ALREADY BUILT AND MUST BE REUSED, NOT REWRITTEN: scripts/check-cited-items.ts imports
ITEM_ID, readCorpus and resolveId from check-handover.ts, and that resolution is load-bearing - 9 of
its 56 sites use shortened or hyphen-broken ids that an exact-match scan misses. Declared ids must
resolve to real items, and a declaration naming a RETIRED item is exactly what check-cited-items
already reports.

SCOPE IT TO NEW FILES. Retrofitting every existing test is not this task and would produce exactly
the fabricated declarations the rule is designed to prevent. A REPORTING mode lists which existing
files declare a basis and which do not - the check-cited-items shape, never gating - so the gap is
visible without anyone being forced to invent a link.

AND CI IS A DELIBERATE QUESTION, NOT AN OVERSIGHT. check:dependencies, check:handover,
check:needs-cycles and check:cited-items are all absent from ci.yml, and the tree convention is that
gates that GATE go in CI while reporters ride npm test through their own test file. This one gates,
so it probably belongs in CI - but check:dependencies not being there is itself an open finding.
Say which you did and why.
