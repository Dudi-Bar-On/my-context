---
id: RULE-never-weaken-byte-identity
type: rule
title: Never weaken a byte-identity or round-trip assertion to make it pass
status: active
severity: hard
always: false
summary: If the write-then-read-back check fails, fix reading or writing; relaxing the check throws away the only evidence that the rebuildable copy really is.
summary_of: 285ef9a2b19c1fa3
scope:
  - test/core/rebuild.test.ts
  - test/core/item.test.ts
tags:
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 9eb96aaffb982caa
directive: dont
---

# Never weaken a byte-identity or round-trip assertion to make it pass

If the round trip fails, the defect is in parse or render — fix it there. These
tests are the only evidence for the claim that the index is disposable, and that
claim is what makes every documented recovery path safe.

## Observations
- [rule] A fixture written raw (not pre-canonicalized) is what makes the test able to fail
- [history] A canonicalized fixture would let a lossy transformation shared by parse and render cancel out and still pass

## Relations
- enforces [[INV-markdown-is-the-source-of-truth]]
