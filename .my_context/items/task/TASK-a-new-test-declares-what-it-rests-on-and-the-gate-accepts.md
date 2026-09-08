---
id: TASK-a-new-test-declares-what-it-rests-on-and-the-gate-accepts
type: task
title: a new test declares what it rests on, and the gate accepts none with a reason
status: active
severity: soft
always: false
summary: New tests must say which rules they assume, or say plainly that they assume none and why.
summary_of: 20cdc312b8bfe34d
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: f6f5b5a6c8f9ea8f
plan: basis
seq: "2"
state: done
priority: "2"
needs: basis/1
verified_on: 2026-09-08
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

DONE 2026-09-08. scripts/check-basis.ts, 34 tests, wired into ci.yml and release.yml, and it gates:
MISSING, MALFORMED and DANGLING fail; RETIRED and UNDECLARED report.

THE `none` FLOOR IS THE RULE’S OWN EXAMPLE: at least three words and twelve characters, so
"none - pure parser mechanics" passes and a bare `none`, `n/a` or `todo` does not. The gate never
judges whether a reason is good.

AND THE 26 FIXTURES PROVED WHY `none` HAD TO BE LEGAL: there was NO corpus item stating the rule they
rested on - the old admission rule lived only in src/core/select.ts and became nameable only when
budget/16 filed the items that reverse it. The honest declaration for all 26 was `none` plus the
sentence a searcher would have needed.

Lane spellings are refused BY NAME, because all ten of that commit’s repair comments wrote
`plan:budget seq:16` rather than an item id.
