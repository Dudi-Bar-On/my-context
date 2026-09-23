---
id: TASK-nine-sites-report-a-measured-zero-for-something-they-could
type: task
title: nine sites report a measured zero for something they could not measure
status: active
severity: soft
always: false
summary: In nine places the tool reports a confident zero for something it was never able to look at, which reads as good news instead of missing information.
summary_of: b43967124e223453
scope:
  - src/core/**
  - src/doctor/checks.ts
  - src/ui/read-model.ts
tags:
  - v2
  - core
  - measured-zero
  - disclosure
  - "plan:walk"
  - "seq:147"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 719d5b0c94af1fd4
plan: walk
seq: "147"
state: doing
priority: "2"
---

# nine sites report a measured zero for something they could not measure

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M5 through M11) as row 36 of `reports/2026-09-13-the-consolidated-findings.md`. NINE SITES, one class.

WHAT WAS MEASURED -- a measured zero standing in for an unmeasured thing, at nine places:
- `drifted: false` reported over a subtree that could not be read.
- A secrets scan reporting `indexed: true` for a session it never read -- on the one screen where being wrong has a cost OUTSIDE the screen.
- `heRollup: {done:0, total:0}` for a manifest that would not parse.
- Two doctor checks reporting their defect counts from a silently truncated walk.
- `sessionsRecorded: 0` for a ledger that would not open.
- `searchArchive` answering "the archive does not contain this" over an empty index.

THE STANDARD IT BREACHES BY NAME: `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`. Both UI reviews independently called this three-state vocabulary -- measured zero, unmeasured, absent -- the project's signature, and report 3 names the two places that already do it right as the template: `corpus-identity.ts`'s `UNREADABLE = -1`, and `context-occupancy.ts`'s missing `percent` field. Its recommendation is to MAKE THE ZERO UNREPRESENTABLE, not merely discouraged.
