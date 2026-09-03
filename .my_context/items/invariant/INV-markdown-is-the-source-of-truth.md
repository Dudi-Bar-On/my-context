---
id: INV-markdown-is-the-source-of-truth
type: invariant
title: Markdown is the source of truth; the SQLite index is disposable
status: active
severity: hard
always: true
summary: The text files are the real copy, and reading them into the fast lookup and back out must not change one byte, or rebuilding quietly destroys work.
summary_of: b0b191b634d6b215
scope: []
tags:
  - architecture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: f555c5079d529fbf
---

# Markdown is the source of truth; the SQLite index is disposable

`files → DB → files` must be byte-identical. "Delete the index, it rebuilds" is the
documented recovery from corruption, schema mismatch and migration bugs — and that
promise is only real while the round trip is lossless. Any field that fails to
survive it silently destroys authored knowledge on the next rebuild.

## Observations
- [invariant] Every Item field survives parse → render → parse unchanged
- [evidence] Proven by a raw-fixture byte-identity test, not a canonicalized one #testing
- [history] An all-digit checksum once parsed as the number 0 and lost its leading zeros; both read and write degraded consistently, so the round-trip test still passed

## Relations
- derived_from [[ADR-markdown-plus-disposable-index]]
- constrains [[RULE-never-weaken-byte-identity]]
