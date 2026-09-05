---
id: TASK-write-the-hebrew-tutorial-files-tracked-as-a-measured-gap
type: task
title: write the Hebrew tutorial files, tracked as a measured gap until then
status: active
severity: soft
always: false
summary: Every tutorial gets a Hebrew file, and until it does, the screen shows that as a measured gap rather than a silent fallback to English.
summary_of: 2efa68451d8331ff
acknowledged:
  - dead_scope@66c3b149409b6a5d
scope:
  - docs/tutorials/**
tags:
  - v2
  - tutorials
  - docs
  - hebrew
  - "plan:tuts"
  - "seq:8"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: a204b7cef21c1da9
plan: tuts
seq: "8"
state: todo
priority: "2"
needs: tuts/1
---

# write the Hebrew tutorial files, tracked as a measured gap until then

Content task, filed alongside tuts/5 and tuts/7 rather than inside either, because its size is every tutorial in the frozen manifest, not a subset. Needs the manifest from tuts/1 and benefits from tuts/5 and tuts/7 landing first, since a Hebrew file translates an English one that must already exist and be stable.

Today zero tutorials have Hebrew content -- docs/TUTORIAL.he.md and docs/TUTORIAL-ADVANCED.he.md do not exist at all. Each docs/tutorials/<id>.he.md carries the same four required headings as its English counterpart, translated rather than summarised, so the heading-presence check tuts/2 already computes turns each row's he cell from todo to done one file at a time and the heRollup line moves off zero. The owner has said this content may be revised again once v2.0 is complete.
