---
id: LESSON-mutation-testing-proves-a-guard-works-not-that-it-sits-in
type: lesson
title: Mutation testing proves a guard works, not that it sits in the right place
status: active
severity: soft
always: false
scope: []
tags:
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 8a19121c92d61bfa
---

# Mutation testing proves a guard works, not that it sits in the right place

A fix normalized line endings on the value passed to a validator but not on the value stored, so validation saw clean text and the write saw dirty text. All fourteen mutation tests passed. Only the completeness sweep caught it.

## Observations
- [symptom] Every guard test green while an accepted input still corrupted its own checksum
