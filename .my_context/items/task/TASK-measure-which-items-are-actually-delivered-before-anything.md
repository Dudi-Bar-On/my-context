---
id: TASK-measure-which-items-are-actually-delivered-before-anything
type: task
title: measure which items are actually delivered, before anything is built on it
status: active
severity: soft
always: false
summary: Find out how often each piece of project knowledge is actually used, so later changes can be judged against a starting point rather than believed.
summary_of: 7b72705785dc18e7
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 03617e3c0f8d8315
plan: loop
seq: "1"
state: done
priority: "1"
---

# measure which items are actually delivered, before anything is built on it

D36a. Plan: docs/superpowers/plans/2026-09-08-self-improvement-instrumentation.md. Spec: docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md section 15. Reading: reports/2026-09-08-contribution-baseline.md, which now carries two dated readings.

DONE. `mycontext contribution` reads per-item delivery backwards out of the audit log, on a text surface and `--json`. It was substantially built on 2026-09-08; what 2026-09-10 added is the correction that had been made BY HAND in prose, and three findings that correction exposed.

THE BASELINE, taken 2026-09-09T23:22:41Z on the owner's real corpus. Corpus 1,076 items; injectable today (isEligible AND isNormative, select's own gate) 158; not injectable by construction 918. Audit records 36,024, of which 2,343 are injections, naming 180 distinct ids. Injectable items the log has NEVER delivered: 0. Delivered and no longer injectable: 22. Cohorts, all counts over the injectable set: human 1,038 items / 152 injectable / 0 never delivered / 0 always spilled / median 641 / 22 delivered-now-ineligible. Agent 38 / 6 / 0 / 0 / median 710 / 0. Ingest 0 throughout. n = 6 for agent and nothing may be concluded from it: no loop exists, so the treatment has not been applied. That is what makes this a control.

THREE THINGS THE MEASUREMENT CONTRADICTED. First, the 2026-09-08 reading's headline finding, twelve normative items never delivered (6.3%), is wrong: every one of the twelve is deprecated or superseded, so select cannot choose any of them today. Measured over the items that actually govern, the answer is ZERO of 158. Second, a record is one DELIVERY, not one session: 1,182 jit, 1,082 subagent-start, 54 session-start, 23 compact-restore, 2 manual. Reading a delivery count as a session count overstates by more than an order of magnitude. Third, the raw delivery count is AGE: the twenty least-delivered injectable items are the twenty most recently created and the twenty most-delivered were all created in August. Deliveries per chance (deliveries over the injection records written since the item's valid_from) collapses a x37.5 raw spread to x2.9. Its ceiling on this log is 0.40, not 1.00, because a JIT delivery carries only path-scoped items.

FOR D36e, WHOSE THRESHOLDS MUST BE DERIVED FROM THIS AND NOT COPIED FROM A PAPER. A "never delivered" retirement rule fires on nothing here. An "always spilled" rule also fires on nothing: 26,417 spill events across 152 items and not one item was ever spilled without also being delivered at least once. A raw-count threshold is a rule about age and would select the newest governing items. The only distribution with shape left after correction is per-chance, spanning 0.139 to 0.399 - whether a threshold can be drawn across a factor of 2.9 is an open question this reading does not answer, and picking a number would be the act of faith section 15 exists to prevent.

WHAT THE INSTRUMENT CANNOT SEE, disclosed on both surfaces on every run rather than only here. It records INJECTION, never reading or reliance: an item opened as Markdown, fetched with `show` or read through MCP `get_item` leaves no trace, so every delivery figure is a floor on use. A raw count is mostly age, and per-chance corrects for exposure but not for records being unevenly spread across days, nor for valid_from being a date while `at` is a timestamp - both push a young item's rate down, so a high rate is trustworthy and a low one on a young item is not. Eligibility is present-tense applied to a historical log, which the delivered-now-ineligible column counts. And where the zero is printed: a quiet run is not a clean corpus - "all 158 injectable items have been delivered" and "the log recorded nothing" draw the same output, so the command prints the record count in the same sentence as the zero.

NON-VACUITY, proved by removal. Replacing the eligibility gate in cohorts with a constant reddens two core tests on five assertions; removing it from undelivered reddens a third; removing the ranked-list filter in the CLI reddens the end-to-end test that asserts a task never appears in the least-delivered list. Each was taken out, watched go red, and restored.
