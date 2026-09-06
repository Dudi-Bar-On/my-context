---
id: TASK-the-conversation-index-and-the-scanner-that-rebuilds-it-from
type: task
title: the conversation index and the scanner that rebuilds it from disk
status: active
severity: soft
always: false
summary: One row per session, built by scanning the transcripts on disk and rebuildable from them at any time.
summary_of: 0ecb489fb0fe5b5d
scope:
  - src/core/**
  - src/cli/commands/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 82517d11a44f9f84
plan: archive
seq: "1"
state: done
priority: "1"
verified_on: 2026-09-07
---

# the conversation index and the scanner that rebuilds it from disk

Step 1 of five in docs/superpowers/specs/2026-09-04-conversation-archive-design.md, which the owner agreed on 2026-09-04 and scheduled into v2.0 on
2026-09-05. Read the spec before building; it settles more than this item repeats.

Every transcript on disk is indexed, with NO time window. That was decided rather than
assumed, and the reason is the reason the feature exists: retrieval matters most for the
conversations you have forgotten, which are exactly the ones a window excludes.

It stays small because it holds one row per SESSION and not per message - roughly two hundred
bytes against a transcript that can reach thirteen megabytes - so a rebuild is one stat and
one tail per file however many sessions accumulate.

The index is derived and never authoritative. A rebuild must reconstruct it entirely from
disk, the way the item index already rebuilds from Markdown, so losing it costs time and
never knowledge.

The spec says this step and the endpoints after it are worth landing alone, because together
they make the data reachable and testable before any pixel is drawn.
