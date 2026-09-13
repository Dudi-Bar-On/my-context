---
id: TASK-one-number-means-nothing-cited-could-not-read-and-read-only
type: task
title: one number means nothing cited, could not read, and read only the last 8 MB of 65 MB
status: active
severity: soft
always: false
summary: A single figure is used for three completely different situations, so a restore can lose most of what it should have kept and the number looks the same.
summary_of: 168b1b3467f7ad51
scope:
  - src/hooks/**
  - src/core/**
tags:
  - v2
  - core
  - measured-zero
  - restore
  - "plan:walk"
  - "seq:148"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 4a03a43a40420d21
plan: walk
seq: "148"
state: todo
priority: "2"
---

# one number means nothing cited, could not read, and read only the last 8 MB of 65 MB

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M19) as row 41 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The PreCompact transcript arm reports the SAME NUMBER for three different situations: "nothing was cited", "the transcript could not be read", and "only the last 8 MB was read".

WHY THAT MATTERS AT THIS SIZE. A real session transcript in this workspace measures 65,046,326 bytes. An 8 MB tail covers about 12% of it, so every id cited in the first 57 MB is dropped from the restore snapshot -- and the number printed is identical to the number printed when nothing was cited at all.

THE CONSEQUENCE. A restore silently loses most of what the window held, and the one figure that would disclose it says the same thing whether or not anything was lost.
