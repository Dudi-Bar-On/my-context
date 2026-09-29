---
id: TASK-filteraudit-never-reads-sinceseq-so-a-caller-that-bounds-a
type: task
title: filterAudit never reads sinceSeq, so a caller that bounds a read by sequence gets an unbounded answer in silence
status: active
severity: soft
always: false
summary: The audit reader accepts a starting sequence number in its filter but ignores it, so anyone asking for records after a point gets every record and is never told the bound was dropped.
summary_of: 6993cbaacbd990d8
scope: []
tags:
  - "plan:release"
  - "seq:36"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 86441c73fb2a61be
plan: release
seq: "36"
state: todo
---

# filterAudit never reads sinceSeq, so a caller that bounds a read by sequence gets an unbounded answer in silence

Confirmed by task 4.16's reviewer on 2026-09-23 (out of that lane's hold): src/core/audit.ts filterAudit (around lines 2020-2035) accepts filter.sinceSeq and never reads it; a caller passing it gets the unbounded answer with no disclosure. Latent - no caller passes it today (context-share.ts and audit-db.ts bound on seq through their own paths since release/13) - but the field is on the public filter type, so the next caller that trusts it is silently wrong. Closing condition: either filterAudit honours sinceSeq (a test plants records across a boundary and asserts only those after it) or the field leaves the filter type so it cannot be passed; INV-nothing-is-dropped-silently. Files: src/core/audit.ts, test/core/audit*.test.ts. Release phase 5.
