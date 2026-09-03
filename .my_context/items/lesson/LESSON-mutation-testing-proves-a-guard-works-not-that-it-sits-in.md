---
id: LESSON-mutation-testing-proves-a-guard-works-not-that-it-sits-in
type: lesson
title: Mutation testing proves a guard works, not that it sits in the right place
status: active
severity: soft
always: false
summary: Proving a check catches what it aims at says nothing about whether it is aimed at the right point, and one placed just past the problem still passes.
summary_of: 867c7f7c3c249ff1
scope: []
tags:
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 25b351d1f5927761
---

# Mutation testing proves a guard works, not that it sits in the right place

A fix normalized line endings on the value passed to a validator but not on the value stored, so validation saw clean text and the write saw dirty text. All fourteen mutation tests passed. Only the completeness sweep caught it.

## Observations
- [symptom] Every guard test green while an accepted input still corrupted its own checksum
