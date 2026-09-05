---
id: TASK-four-literal-facts-a-tutorial-states-are-checked-against-the
type: task
title: four literal facts a tutorial states are checked against the code
status: active
severity: soft
always: false
summary: Four facts tutorials state as literal values are checked against the code that would make them wrong, instead of trusted by eye.
summary_of: e179c44ead748071
scope:
  - test/core/**
  - docs/tutorials/**
tags:
  - v2
  - tutorials
  - docs
  - drift
  - "plan:tuts"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 049c42118f0337b2
plan: tuts
seq: "6"
state: todo
priority: "2"
needs: tuts/5
---

# four literal facts a tutorial states are checked against the code

Step 6 of six in docs/superpowers/plans/2026-09-05-tutorials-are-served-and-browsed.md. Needs the migrated content from tuts/5.

Four independent tests extract a literal claim from the migrated tutorial text and diff it against the live source: the version string against package.json, the named hook list against what src/hooks/ actually registers, the profile names against what src/core/config.ts accepts, and the budget tier numbers against src/core/config.ts's own tier definitions. These are exactly the five reports/2026-08-22-DOCS-REVIEW.md findings (F4, F7, F8, F11, F14) that sit today under headings the Tutorials screen ticks as done without checking their prose.

This is an extension of the existence check the screen already performs, not a new kind of gate: it only ever compares a literal token to a literal token, and it does not and cannot verify that the surrounding explanation is accurate -- that stays a human documents-review responsibility.
