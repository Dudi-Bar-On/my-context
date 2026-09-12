---
id: TASK-retire-on-evidence-and-bound-the-corpus
type: task
title: retire on evidence, and bound the corpus
status: active
severity: soft
always: false
summary: Remove suggestions that were never used, based on whether they were ever needed rather than on how old they are, and stop the collection growing without limit.
summary_of: 60c0904ae88d8d12
acknowledged:
  - task_unverified@0d7262ed0fd3fce9
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 73fbaa6318beda8b
plan: loop
seq: "5"
state: done
priority: "2"
needs: loop/4
---

# retire on evidence, and bound the corpus

D36e. BUILT AND MEASURED 2026-09-11. THE ANSWER IS THAT NO DEFENSIBLE THRESHOLD EXISTS YET, and the
measurement is the deliverable. reports/2026-09-11-retirement-thresholds.md.

WHAT THE CORPUS SAYS (2026-09-11T00:04:53Z, 1,085 items, 157 injectable, 2,421 injection records of
38,723, window 24 days). Five refusals, each a number. (1) The population any mechanism here may
touch is origin:review, and it is EMPTY - 0 items, because maxProposalsPerPass ships at 0 and the
loop has never proposed anything. (2) "never delivered" selects 0 of 157. (3) "only ever spilled"
selects 0 of 157, across 26,843 spills on 152 items. (4) The log covers 24 days and this item
requires a month. (5) THE ONE NOBODY PREDICTED: the low tail of every exposure-corrected delivery
statistic is the PINNED TIER. All 39 always:true items rank in the least-delivered 69 of 157; the
best pinned rate is 0.281 against an unpinned median of 0.357; 7 of the 20 lowest-rate items are
pinned, among them CONST-zero-runtime-dependencies, CONST-node-24-no-build-step,
RULE-erasable-syntax-only and INV-nothing-is-dropped-silently. A pinned item wins only at the pinned
doors while the denominator counts JIT, which is half the log - CONST-zero-runtime-dependencies is
delivered at 328/1,122 subagent starts, 9/54 session starts and 19/1,220 JIT fires. So a delivery
rate ranks items by WHICH DOOR THEY COME THROUGH, and a cut at the bottom of it retires the
project's standing constraints. Two corrections were tried and neither rescues it: normalising by
delivered slots rather than records gives the same ordering (3.26-8.98 per mille, x2.7), and ranking
within an exposure cohort gives 0.47-2.40 relative to the median item of the same age, with a cut at
0.25 selecting nothing and a cut at 0.5 selecting one item delivered 150 times.

WHAT SHIPPED INSTEAD OF A NUMBER. src/core/retire.ts, a pure reader that opens nothing and writes
nothing. RETIREMENT_RULE is null; a RetirementRule carries derivedOn and derivedIn beside its two
thresholds, so a threshold cannot be written down without naming the day it was measured.
derivability(evidence) is the gate, re-derived on every run from the five clauses above - each a
zero, a whole population, or this item's own month - so when the corpus changes the gate changes its
mind on its own. separation() and tierSkew() are the two statistics that produced the finding, kept
runnable so the objection survives the corpus moving. candidates() and overCap() are built and
tested and passed no rule and no cap: restricted to origin:review, action always deprecate and never
delete, a human item neither a candidate nor counted against the cap.

BOUND THE CORPUS. The bound already in force is the ration: maxProposalsPerPass 0, so the population
cannot grow and a cap on it would have nothing to measure against. What IS growing is the payload,
and payloadTrend() measures it per door per day: subagent-start carried 21.5 items a dispatch on
2026-08-26 and 78.5 on 2026-09-11 - 3.7x in sixteen days - while spilling nothing, because that
door's budget does not bind. compact-restore went 3.0 to 158.0, session-start 3.0 to 142.8 and began
spilling on 2026-09-04, and JIT spilled 55-65% of everything it selected through early September. A
bound derived from spill alone would have called the corpus bounded at exactly the door where it
grows fastest.

THE SURFACE. mycontext contribution --retire, and it has NO VERB: no --apply, no flag that retires,
deprecates or deletes, and retire.ts imports nothing outside core/ and nothing that writes - both
pinned by test/core/retire.test.ts. Section 13 stands: the owner promotes, always.

ALSO FIXED. A pending revision's oldestAt was leaking into the drafts summary of status --json,
left by D36d: review/pending.ts now splits the two queues (draftsOnly beside the combined view) and
the reviewQueue block quotes the drafts half. test/cli/review-revisions.test.ts is green again.

TESTS. 29 unit assertions across test/core/retire.test.ts, retire-cap.test.ts and retire-gate.test.ts,
5 CLI assertions in test/cli/contribution-retire.test.ts, 2 added to test/review/pending.test.ts.
19 removal proofs, one per assertion, all red.

WHAT MEASUREMENT CONTRADICTED. D36a handed forward that per-chance was "the only distribution with
any shape left". It has shape and the shape is tier membership, running backwards: the oldest
exposure quartile has a median rate of 0.166 against 0.371 for the second. The plan's Task 2 asked
for decay --apply; it was refused, because an apply path is the one thing section 13 forbids. Task 4
(re-measure and say whether it worked) cannot be done at all yet: the treatment has never been
applied, so there is no cohort to compare.
