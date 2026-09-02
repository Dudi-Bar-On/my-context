---
id: ADR-normative-vs-rationale-tiers
type: adr
title: Split categories into normative and rationale tiers
status: active
severity: soft
always: false
scope: []
tags:
  - architecture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: d6940227c05f46d4
---

# Split categories into normative and rationale tiers

Context: injecting everything would crowd out the user’s own context as the corpus
grows, and ADRs and lessons will always be the bulk of what gets written.

Decision: normative categories may be injected in full; rationale categories are
only ever counted in a bounded index.

Consequence: context cost stays fixed whether the corpus holds 40 items or 4,000.
An ADR explains why; the constraint it produced is what must be obeyed.

## Observations
- [driver] Documented failure modes of in-context memory at scale: capacity overflow, fact destruction during compaction, and behavioural drift from constraint erosion

## Relations
- produced [[INV-nothing-is-dropped-silently]]
