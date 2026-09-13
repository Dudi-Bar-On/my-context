---
id: TASK-one-concept-has-six-flag-spellings-and-all-means-widen-a
type: task
title: one concept has six flag spellings, and --all means widen a read in two commands and widen a write in two others
status: active
severity: soft
always: false
summary: The same idea is spelled six different ways across commands, and one option means two different things, one of which changes data.
summary_of: 694ae029ba263d01
scope:
  - src/cli/**
tags:
  - v2
  - cli
  - vocabulary
  - "plan:cliscript"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 4e487f687ff91b69
plan: cliscript
seq: "6"
state: todo
priority: "3"
---

# one concept has six flag spellings, and --all means widen a read in two commands and widen a write in two others

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C8) as row 114 of `reports/2026-09-13-the-consolidated-findings.md`. ONE CONCEPT, SEVERAL SPELLINGS, measured:

- "REMOVE THIS" HAS SIX: `--clear`, `--off`, `--none`, `--drop`, `--discard`, `--unset`.
- "CATEGORY" HAS FOUR.
- `--all` MEANS TWO DIFFERENT THINGS: "widen the listing" in two commands, "switch to bulk mode" in two others.
- `ingest.ts` · the sentence that uses both "candidate" and "draft" (line 387) uses "candidate" and "draft" in ONE SENTENCE for ONE concept.

WHY IT IS UNDER THIS SUBJECT. A person learns a spelling once and guesses the rest; a script and an agent cannot guess at all. `--all` meaning two opposite-risk things in one binary is the sharpest of the four: one widens a read and the other widens a WRITE.

THE WORK IS A VOCABULARY PLUS A GATE, not a rename pass -- the flag tables are already machine-readable and already pinned against the registry in both directions.
