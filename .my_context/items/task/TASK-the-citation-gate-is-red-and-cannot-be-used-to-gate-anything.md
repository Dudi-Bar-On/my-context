---
id: TASK-the-citation-gate-is-red-and-cannot-be-used-to-gate-anything
type: task
title: the citation gate is red and cannot be used to gate anything else until it is cleared
status: active
severity: soft
always: false
summary: Most citations in the corpus no longer point where they say, and five broken ones keep the gate failing.
summary_of: 9d32201bc00d6fe1
scope:
  - scripts/**
  - docs/superpowers/**
tags:
  - v2
  - citations
  - tooling
  - "plan:rulings"
  - "seq:64"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 3afa5d273ec2bada
plan: rulings
seq: "64"
state: todo
priority: "2"
---

# the citation gate is red and cannot be used to gate anything else until it is cleared

Measured 2026-09-05 by running the gate rather than reading about it.

1,198 citations across 40 documents: 271 correct, 862 MOVED, 60 historical, 5 broken. And 518
citations across 134 source files: 196 correct, 294 moved, 2 historical, 26 broken. 59 markers,
39 faults.

The five broken documentation citations are what set the exit code to 1. They sit in planning and
specification documents from 2026-08-19 and 2026-08-20. The 26 broken source citations are
REPORTED and not gated: they fail only under strict-source, which the tool says plainly is the
whole of the flip.

The number that matters is not the five, it is the 862. Nearly three quarters of the citations in
the documents point at a line that has moved. Each one still resolves to a file, so nothing is
lost, but a citation whose line is wrong stops being something a reader can follow and becomes
something a reader has to search for. A design record nobody can navigate is a design record
nobody reads, and this project requires reading it before acting.

The consequence today is concrete and is why this is filed rather than left. A handover task
whose own bar was every gate green could not close, because this gate is red for reasons that
have nothing to do with handover. A red gate that everybody learns to step over stops being a
gate, and this one has been red long enough for a task to be held open by it.

Establish before repairing. A moved citation is mechanical and the tool already knows both the
old and the new line, so the question is whether it can rewrite them rather than only report
them, and whether doing so in bulk is safe on a corpus this size. A broken one is different: the
target may have been renamed, split or deleted, and only a person can say which.

Decide and state what the gate should do about moved citations at all. If 862 of them are
expected drift in a living repository, then reporting each one on every run is noise that hides
the five that matter, and the gate should say so differently. If they are not expected, the
corpus has rotted quietly for weeks and the repair is the work.
