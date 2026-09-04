---
id: TASK-three-browser-specs-needed-a-corpus-with-findings-after
type: task
title: three browser specs needed a corpus with findings after doctor reached zero
status: active
severity: soft
always: false
summary: Specs that settle doctor findings had no subject once the corpus was clean, and failed loudly rather than passing vacuously.
summary_of: 8de5ab7f1cfc30d6
scope: []
tags:
  - v2
  - backfill
  - "plan:walk"
  - "seq:138"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 27b01a2da6eef8c7
plan: walk
seq: "138"
state: done
verified_on: 2026-09-04
priority: "3"
---

# three browser specs needed a corpus with findings after doctor reached zero

doctor-settle, doctor-outcome and execute-output each required a live finding to drive. Their anti-vacuity guards fired correctly. Each now builds a throwaway workspace with deliberate findings and destroys it, under the owner exception for creating test data and retiring it. Shipped in 2143868 and the commits around it.
