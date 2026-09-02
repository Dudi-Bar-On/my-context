---
id: KNOWN-the-ledger-handle-leak-detector-cannot-detect-a-leak
type: known_issue
title: the ledger handle-leak detector cannot detect a leak
status: active
severity: soft
always: false
summary: The check meant to catch a file left open can never fail, because the cleanup it relies on hides the very error it is watching for.
summary_of: da1d553289094065
scope: []
tags:
  - v2
  - tests
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: b975de507a4bf788
---

# the ledger handle-leak detector cannot detect a leak

test/core/ledger.test.ts uses removeTree(tmpDir) as its assertion. removeTree SWALLOWS the failure into an 'unremovable' array printed at exit, so a pinned handle produces a stderr note rather than a red test.

A bare non-recursive rmSync(dbPath) throws and does work; the newer ledger-readonly suite already uses that. This is a checker that cannot fail, which is the class of defect this project has now found five times.

## Observations
- [note] reported by an implementing agent; reports/2026-08-21-FINDINGS.md entry 7
