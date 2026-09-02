---
id: RULE-harness-cases-must-reach-the-behaviour-they-name
type: rule
title: Harness cases must reach the behaviour they name
status: active
severity: hard
always: false
summary: Make sure a test actually gets as far as the thing it claims to test, or it will report a comfortable result while having tested nothing.
summary_of: 7510ebc0e4999d18
scope:
  - harness/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-17
valid_until: null
checksum: dbd667f9f5b04a4b
---

# Harness cases must reach the behaviour they name

A case that short-circuits before exercising its target records a plausible result that tests nothing. Verify each case reaches the code path in its name.
