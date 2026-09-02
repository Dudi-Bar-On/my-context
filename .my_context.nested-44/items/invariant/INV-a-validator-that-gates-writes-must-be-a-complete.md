---
id: INV-a-validator-that-gates-writes-must-be-a-complete
type: invariant
title: A validator that gates writes must be a complete precondition for the write
status: active
severity: hard
always: false
scope:
  - src/ingest/**
  - src/core/mutate.ts
  - src/core/validate.ts
  - src/core/trust.ts
tags:
  - ingest
  - correctness
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 9c3ed800b883751c
---

# A validator that gates writes must be a complete precondition for the write

If validateCandidates accepts a candidate that createItem then refuses, a batch ingest half-applies: some items land, one throws, and the session is left in a state no single component owns. The property is testable as a number - generate candidates, keep the accepted ones, write each and re-read it - and the number of failures must be zero.

## Observations
- [evidence] A sweep of 34746 generated candidates accepted 11488 and found zero round-trip failures
- [method] Vary more than one field per row - single-field perturbation missed a CRLF body bug that survived three review rounds
