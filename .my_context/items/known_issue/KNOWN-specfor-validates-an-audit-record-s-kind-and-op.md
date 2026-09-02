---
id: KNOWN-specfor-validates-an-audit-record-s-kind-and-op
type: known_issue
title: specFor validates an audit record's kind and op independently
status: active
severity: soft
always: false
summary: A history entry can declare a type and an action that do not belong together, so two ways of asking the same question give different answers.
summary_of: 20659848eb330304
scope: []
tags:
  - v2
  - audit
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: e06d587a3917f471
---

# specFor validates an audit record's kind and op independently

A record declaring kind: 'mutation' with op: 'step-done' is ADMITTED. Reachable by a hand-edited or imported line, not by a typed writer.

It matters because 'mycontext audit --kind progress' selects on kind while a replay selecting on op would answer the same question with a different record set.

Found by a mutation that SURVIVED: the test that should have caught it was passing for the wrong reason, because its fixture tripped the op guard first.

## Observations
- [note] reported by an implementing agent; reports/2026-08-21-FINDINGS.md entry 8
