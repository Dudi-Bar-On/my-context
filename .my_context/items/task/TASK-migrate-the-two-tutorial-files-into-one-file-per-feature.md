---
id: TASK-migrate-the-two-tutorial-files-into-one-file-per-feature
type: task
title: migrate the two tutorial files into one file per feature
status: active
severity: soft
always: false
summary: The two tutorial files split into one file per feature, each teaching that feature from both the CLI and the UI.
summary_of: 4b22d5cb245006bc
acknowledged:
  - dead_scope@64b33da6252909f0
scope:
  - docs/tutorials/**
  - docs/TUTORIAL.md
  - docs/TUTORIAL-ADVANCED.md
tags:
  - v2
  - tutorials
  - docs
  - "plan:tuts"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: bb52262c03101970
plan: tuts
seq: "5"
state: done
priority: "2"
needs: tuts/1
verified_on: 2026-09-05
---

# migrate the two tutorial files into one file per feature

Step 5 of six in docs/superpowers/plans/2026-09-05-tutorials-are-served-and-browsed.md. Needs the manifest from tuts/1. The largest task in the plan by volume, expected to span several sessions rather than one sitting.

Every manifest entry that corresponds to an existing chapter of docs/TUTORIAL.md or docs/TUTORIAL-ADVANCED.md becomes its own docs/tutorials/<id>.md, carrying the existing CLI-facing prose forward and adding the From the UI section every current chapter is missing -- checked against the real screen, not asserted. The two original files stay in place as pointers rather than dead ends for an existing link or search.

The load-bearing promise in docs/TUTORIAL.md -- every command and block of output run against a fresh workspace, nothing illustrative -- must survive the split unchanged: every worked block in every migrated file is re-run before it is checked in, not carried over by copy-paste.
