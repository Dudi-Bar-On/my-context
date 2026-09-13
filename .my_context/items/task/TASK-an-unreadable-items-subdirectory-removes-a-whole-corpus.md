---
id: TASK-an-unreadable-items-subdirectory-removes-a-whole-corpus
type: task
title: an unreadable items subdirectory removes a whole corpus layer with no load error, while a broken symlink is reported
status: active
severity: soft
always: false
summary: If one folder of knowledge cannot be read the whole layer disappears without a word, although a different kind of breakage in the same walk is reported properly.
summary_of: c231eddca20a1936
scope:
  - src/core/rebuild.ts
  - src/core/**
tags:
  - v2
  - core
  - silent-failure
  - corpus
  - inferred
  - "plan:swallow"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 9292ed0ce421d5d7
plan: swallow
seq: "4"
state: todo
priority: "1"
---

# an unreadable items subdirectory removes a whole corpus layer with no load error, while a broken symlink is reported

INFERRED, NOT REPRODUCED. The branch was read; an unreadable directory was never created and the silent drop was never observed. THE FIRST STEP OF THIS WORK IS TO REPRODUCE IT -- deny read on one `items/` subdirectory and count the `LoadError`s. If the load does report it, that is a legitimate outcome and this item closes as a false premise; three items this week have closed that way.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B5) as row 9 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT THE CODE DOES. An unreadable `items/` subdirectory removes a whole corpus layer and produces ZERO `LoadError`s. The comparison inside the same function is what makes this a defect and not an oversight: a broken SYMLINK in that same walk IS reported, and the function's own docstring says the walk is "never skipped in silence".

THE CONSEQUENCE. A session runs with a whole category of governing items missing and nothing anywhere says a directory could not be read. The doctrine is written down in the docstring and the code does not implement it.
