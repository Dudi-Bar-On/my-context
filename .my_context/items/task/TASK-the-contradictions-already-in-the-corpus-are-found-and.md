---
id: TASK-the-contradictions-already-in-the-corpus-are-found-and
type: task
title: the contradictions already in the corpus are found and reported, never gated
status: active
severity: soft
always: false
summary: Finding the conflicts that are already there, since guarding new writes does nothing about the ones already written.
summary_of: 05b2f149a396a683
scope:
  - src/core/**
  - src/cli/**
  - src/mcp/**
  - test/**
tags:
  - v2
  - governance
  - corpus
  - "plan:contra"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 9cfd7231d12eaaca
plan: contra
seq: "3"
state: done
priority: "1"
needs: contra/1
verified_on: 2026-09-10
---

# the contradictions already in the corpus are found and reported, never gated

Design of record: docs/superpowers/specs/2026-09-07-contradiction-gate-design.md section 9.

contra/1 guards NEW writes only. Turning it on does nothing about what is already in the corpus, and
there are known cases: in one working day this project found FIVE superseded instructions being
acted on as current, including two comment blocks in e2e/app.ts asserting opposite things about
which corpus it uses, forty lines apart, both live.

SO: a DOCTOR CHECK that scores active normative items pairwise and reports the closest pairs for a
human to settle. It never gates and never blocks. It is how the existing debt drains.

IT IS DELIBERATELY NOT PART OF contra/1, for two reasons: nobody should mistake the gate for a cure,
and a pairwise sweep smuggled into a write path would slow every write for no benefit.

REUSE THE VERDICT STORE from contra/1: a pair already ruled distinct must not be reported here
either, and a verdict that has lapsed because one item changed meaning SHOULD be. Otherwise the
drain and the gate would disagree about the same pair, which is the failure this whole subject
exists to prevent.

DONE 2026-09-10. checkCorpusContradictions in doctor/checks.ts, in runChecks, at info only - off the
exit code, so it reports and never gates. It reads the gate's own verdict log, so a pair already
settled is silent here too and lapses in both places on the same event; the log's read half moved to
core/verdict-store.ts because doctor/checks.ts is in the UI server's import graph and had to reach
those rulings without importing the module that writes items.

WHAT IT FINDS HERE: 21,528 pairs over the 208 items that currently govern and are in scope, 82 clear
0.45, 7 of those are ALREADY SETTLED by a recorded ruling from the gate, 69 are dropped, and 6 are
reported. The six are real pairs of governing items about one subject - the UI-upkeep decision
against the server-running requirement, the two Playwright rules, the stop-hook decision against the
handover requirement, the focus decision against the focus requirement.

TWO MEASUREMENTS CORRECTED THE DESIGN, and both are in the code with their numbers.

FIRST, A NAIVE PAIRWISE SWEEP IS 88% ONE ITEM. 72 of the 82 pairs involve REF-the-d-numbers alone, a
pinned 808-token reference index whose jaccard with each of those partners is 0.13 to 0.16 - the
score is coming entirely from containment, which is measuring LENGTH and not subject, because almost
any ordinary item's vocabulary is nearly a subset of an 808-token English body. So the population is
the gate's score, which is what stops the two disagreeing about which pairs exist, and the RANKING is
jaccard, with a floor at the OVERLAP_THRESHOLD that already meant "worth showing a person" and one
finding per item. Neither number was invented for this check.

SECOND, AND IT BOUNDS WHAT THIS CAN EVER CLAIM: the contradiction section 1 of the design opens with
- DEC-the-ui-is-developed-against-a-simulated-corpus-until-the against
INSTR-testing-happens-against-the-current-corpus-and-an-exception, the one that cost a morning of
misdiagnosis while both were live - scores 0.267, jaccard 0.150, among 11,079 pairs in the 0.20-0.30
band. No lexical cutoff admits it and excludes them, and the maximum jaccard between any two
governing items in this corpus is 0.345. So this reports THE CLOSEST PAIRS and says so: the coverage
line names that measurement, states that a contradiction between two items sharing little vocabulary
is invisible, and ends "none found is not none present". The drain drains what a person can be handed
cheaply; it is not a census, and I should not read a quiet run as a clean corpus.
