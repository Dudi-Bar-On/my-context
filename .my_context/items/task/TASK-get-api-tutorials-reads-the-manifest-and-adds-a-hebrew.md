---
id: TASK-get-api-tutorials-reads-the-manifest-and-adds-a-hebrew
type: task
title: GET api tutorials reads the manifest and adds a Hebrew rollup
status: active
severity: soft
always: false
summary: The tutorials list endpoint reads the generated manifest instead of six hard-coded rows, and adds a rollup stating how many tutorials have Hebrew content.
summary_of: 194c7fe86c1dd431
scope:
  - src/ui/read-model.ts
tags:
  - v2
  - tutorials
  - ui
  - docs
  - "plan:tuts"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: ebe6f4bfd0b59b17
plan: tuts
seq: "2"
state: todo
priority: "2"
needs: tuts/1
---

# GET api tutorials reads the manifest and adds a Hebrew rollup

Step 2 of six in docs/superpowers/plans/2026-09-05-tutorials-are-served-and-browsed.md. Needs the manifest from tuts/1.

Widens apiTutorials (src/ui/read-model.ts) to answer one row per manifest entry -- id, a job title, tier, and the same done/todo/unmeasured en/he state TUTORIAL_TARGETS computes today -- instead of the six-row TUTORIAL_ROWS. Adds heRollup: {done, total}, computed from the same per-row states, so a reader sees '0 of N written' as a stated fact rather than N individual chips they have to count themselves -- the measured-zero case STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is governs.
