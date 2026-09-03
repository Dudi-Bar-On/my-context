---
id: LESSON-dogfooding-found-the-missing-edit-path
type: lesson
title: Dogfooding found in one command what 175 tests did not
status: active
severity: soft
always: false
summary: Doing one real task end to end exposed an entirely missing feature the tests had all passed over, because each checked a step and none the journey.
summary_of: 444f3808425a75ae
scope: []
tags:
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 72bdf59ca5e50c69
---

# Dogfooding found in one command what 175 tests did not

Creating a single real item and trying to make it useful surfaced that the product
had no supported edit path — `add` writes a bare skeleton and any edit trips the
checksum. Every test passed, because each tested a step and none tried the journey.

## Observations
- [method] Run the shortest real user task end to end before believing a green suite

## Relations
- produced [[REQ-an-item-must-be-editable]]
