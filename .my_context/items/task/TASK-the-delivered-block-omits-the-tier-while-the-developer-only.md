---
id: TASK-the-delivered-block-omits-the-tier-while-the-developer-only
type: task
title: the delivered block omits the tier, while the developer-only view prints it
status: active
severity: soft
always: false
summary: The view that tells an assistant which rules it has leaves out how much authority each one carries, while a view only developers open shows it.
summary_of: 0448ba72e1e94aa7
scope:
  - src/rules/**
tags:
  - v2
  - store
  - disclosure
  - "plan:store"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 254d30f34ea08783
plan: store
seq: "12"
state: todo
priority: "3"
---

# the delivered block omits the tier, while the developer-only view prints it

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, S9) as row 82 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The delivered block prints an entry as `` `id` . kind `` and OMITS THE TIER, while the developer-only `rules show` prints the tier.

WHY THE ASYMMETRY IS THE DEFECT. The tier is what tells a reader how much authority an entry carries. The surface where that matters is the one delivered into a model's context at every door; the surface that shows it is the one only a developer opens.

THE FIX IS THE SMALLEST IN THE STORE SET: print the field that is already computed, on the surface that already has it.
