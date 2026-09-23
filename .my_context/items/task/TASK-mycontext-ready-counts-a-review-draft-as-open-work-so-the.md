---
id: TASK-mycontext-ready-counts-a-review-draft-as-open-work-so-the
type: task
title: mycontext ready counts a review draft as open work, so the board moves when nobody filed anything
status: active
severity: soft
always: false
summary: The command that lists what is ready to work on also lists items that are only proposals awaiting a person's approval, so the count of open work rises silently whenever the automatic review proposes something.
summary_of: 325db6aed2612024
scope: []
tags:
  - "plan:release"
  - "seq:23"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: e09fa3ba0274e9d1
plan: release
seq: "23"
state: doing
---

# mycontext ready counts a review draft as open work, so the board moves when nobody filed anything

Measured 2026-09-22 during release phase 3: the review pass created ten task drafts (origin review, status draft, under .drafts/task/) from the dispatching session's own prompts, and mycontext ready --json reported open 146 where the board held 136 - the ten drafts were listed among ready rows with plan null. A draft is indexed and searchable but governs nothing and is never injected (mycontext help capture); it is not work anyone can dispatch until a person promotes it, and review promote is where it gains a plan and a seq (review/10, phase 5). Closing condition: ready, ready --json and ready --held exclude items whose status is draft from open, ready and held, and say in one line how many drafts await review (mycontext review list); check:board and the D map are unaffected; a test plants a draft task and asserts it is counted in the drafts line and nowhere else. Files: src/cli/commands/ready.ts (or wherever ready is composed), src/core/needs.ts if the frontier is computed there, test/cli/ready*.test.ts. Release phase 4 (silent failures and disclosures).
