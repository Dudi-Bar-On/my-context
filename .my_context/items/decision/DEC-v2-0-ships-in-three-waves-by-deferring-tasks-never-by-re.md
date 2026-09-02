---
id: DEC-v2-0-ships-in-three-waves-by-deferring-tasks-never-by-re
type: decision
title: v2.0 ships in three waves by deferring tasks, never by re-cutting the plans
status: active
severity: soft
always: false
summary: The release goes out in three stages, and anything that must wait is moved to a later stage rather than the plans being redrawn around it.
summary_of: 1815dbf26406f316
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: 69d5f891dedcfd9e
---

# v2.0 ships in three waves by deferring tasks, never by re-cutting the plans

Wave 1: plan 1 tasks 1-17 plus the coverage map from task 18. Wave 2: plan 2 whole (palette, Work, then Configure). Wave 3: plan 3 whole, plus plan 1's deferred tasks 18 (ego graph) and 19 (Report, Learn).

Work ships in wave 2 WITHOUT stream-driven refresh; the stream is plan 3 tasks 6 and 11 and arrives in wave 3. That divergence from the UI/UX review's recommendation is accepted and stated.

Deferring a task does not invalidate a re-verified plan. Re-cutting does, and the re-verification pass is about to happen.
