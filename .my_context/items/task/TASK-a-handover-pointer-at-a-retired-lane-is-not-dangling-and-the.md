---
id: TASK-a-handover-pointer-at-a-retired-lane-is-not-dangling-and-the
type: task
title: a handover pointer at a retired lane is not dangling, and the check must stop saying it is
status: active
severity: soft
always: false
summary: A note pointing at work that was deliberately retired should say so, instead of being reported as pointing at nothing.
summary_of: 36d220233c2274ab
scope:
  - scripts/check-handover.ts
  - test/**
tags:
  - v2
  - governance
  - handover
  - "plan:handover"
  - "seq:18"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 82ee9096b44b5d17
plan: handover
seq: "18"
state: done
priority: "1"
verified_on: 2026-09-08
---

# a handover pointer at a retired lane is not dangling, and the check must stop saying it is

Found 2026-09-07, immediately and by consequence: the owner ruled on 45 walk items, seven were
retired with successors, and scripts/check-handover.ts went RED on three of them - walk/16, walk/21
and walk/131 - calling each one DANGLING and gating on it.

THE VERDICT IS WRONG, AND IT IS WRONG IN THE EXACT WAY THIS PROJECT SPENT THE DAY MEASURING.
The check prints "N resolving to nothing" and, when clean, "every pointer in the handover names
something that exists". A retired item EXISTS. It has a file, a status, and - because the retirement
was done properly - a superseded_by edge naming what replaced it. Reporting it as nothing conflates
RETIRED with ABSENT, which is the same conflation TASK-code-and-tests-that-speak-with-a-retired-item
s-authority was filed about and which scripts/check-cited-items.ts deliberately does NOT make.

THE MECHANISM. check-handover resolves a plan/seq through buildTaskIndex (src/core/needs.ts:211),
which walks workItems(items, config) - active work only. A retired task leaves that index, so the
lane key has no bucket, so `resolved` is null, so it is DANGLING, so the gate fails.

WHAT TO BUILD. When a lane key has no ACTIVE item but the corpus holds a RETIRED one under that key,
report it as its own verdict - RETIRED, naming the successor from the superseded_by edge - and do NOT
gate on it. DANGLING keeps its meaning and its exit code: a pointer nothing answers to at all.

WHY IT MUST NOT GATE. The handover is a HISTORICAL DOCUMENT, appended to at every percent. A block
written in the morning that names a lane retired in the afternoon was TRUE WHEN WRITTEN and is still
the record of what happened. Gating on it would force either rewriting history or never retiring
anything a handover has mentioned - and the second is how a corpus stops retiring things. This is the
same shape as the owner ruling that check-cited-items reports rather than gates.

AND IT IS URGENT RATHER THAN TIDY: HEAD is red until this lands, and a red HEAD poisons attribution
for every lane dispatched after it. This project has already lost real time to lanes proving that a
failure was not theirs.

THE ANTI-VACUITY QUESTION TO ANSWER WHILE IN THERE: after this change, would the check still fail on
a genuinely invented pointer? Prove it with a test that names a plan/seq no item has ever carried.

DONE 2026-09-08, verified here: check:handover exit 0, tsc clean, 55 tests.

A third tier, RETIRED, reported and never gated, naming the successor by following superseded_by to
the END rather than one hop. DANGLING keeps its meaning and its exit code untouched, and a
process-level test plants a plan/seq no item has ever carried and asserts exit 1, so the gate is not
now vacuous.

IT WAS FOUR POINTERS, NOT THREE - walk/3 was retired on 09-05, older than I said. And
RETIRED_STATUSES and what workItems drops are NOT complements: workItems drops only `superseded`,
deliberately, so a deprecated task keeps resolving as live work. Pinned by a test so the divergence
cannot drift silently.
