---
id: LESSON-dogfooding-found-the-missing-edit-path
type: lesson
title: Dogfooding found in one command what 175 tests did not
status: active
severity: soft
always: false
scope: []
tags:
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 02b3edce1967d9c3
---

# Dogfooding found in one command what 175 tests did not

Creating a single real item and trying to make it useful surfaced that the product
had no supported edit path — `add` writes an inert skeleton and any edit trips the
checksum. Every test passed, because each tested a step and none tried the journey.

## Observations
- [method] Run the shortest real user task end to end before believing a green suite

## Relations
- produced [[REQ-an-item-must-be-editable]]
