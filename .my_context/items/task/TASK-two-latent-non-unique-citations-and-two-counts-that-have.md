---
id: TASK-two-latent-non-unique-citations-and-two-counts-that-have
type: task
title: two latent non-unique citations, and two counts that have gone stale
status: active
severity: soft
always: false
summary: Two references will point at the wrong line the moment the code moves, and two counts written into the plans have gone out of date.
summary_of: c7b4a4c3116e5c30
scope: []
tags:
  - "plan:rulings"
  - "seq:37c"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 13ea5efc194409e6
plan: rulings
seq: 37c
state: done
priority: "2"
---

# two latent non-unique citations, and two counts that have gone stale

Found by ruling 37b's sweep over all 28 gated documents, reported rather than fixed because each sits in a different owner's document or could not be resolved honestly.

THIRTEEN citations name a fragment occurring more than once, not seven. The seven were exactly the non-unique AND moved set - the other six are already ok, so --fix does not rewrite them today. Four of those six are plural on purpose: the prose says 'repeated at' and means every occurrence.

Two are latent:

1. categories plan line 1427 cites a filter line in cli/commands/repair.ts occurring at 32 and 45. Line 32 is needsRestamp, which is what the row is about; 45 is skippedGlobal. Safe today, wrong the moment repair.ts shifts. Remedy: cite 'export function needsRestamp(items: Item[]): Item[] {' instead.

2. export plan line 210 cites a doctor/checks.ts line occurring at 226 in checkSnapshotDrift and 280 in checkSourceDrift. The row's claim is true at BOTH, so neither anchor makes it false - which is why the agent deliberately left it: a unique fragment on the wrong occurrence is worse than an ambiguous one.

Two counts have gone stale:

3. hooks plan line 101 says 'all four commands carry --disable-warning=ExperimentalWarning'. hooks.json now registers SIX and all six carry it. The substance holds; the number does not. Row 199 states it correctly without a number.

4. never-miss plan line 25 says the 10s timeout is 'repeated at ~23 and ~34'. The lines are 34 and 45; line 23 is now a timeout of 5.
