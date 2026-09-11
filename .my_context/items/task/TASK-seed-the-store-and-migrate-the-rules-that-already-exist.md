---
id: TASK-seed-the-store-and-migrate-the-rules-that-already-exist
type: task
title: seed the store, and migrate the rules that already exist, reversibly
status: active
severity: soft
always: false
summary: The rules that already governed this project now live inside the tool itself, one copy each, and a rule that ships to everyone no longer points at a note only this project has.
summary_of: fd4eba6056f1655a
summary_was:
  - 2026-09-11 Move the rules that already govern this project into the new store, once, carefully, and only when it is ready.
scope:
  - src/rules/entries/**
  - .my_context/items/**
  - scripts/**
  - test/rules/**
tags:
  - v2
  - store
  - "plan:store"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 817f3969ee9eb999
plan: store
seq: "4"
state: done
priority: "1"
needs: store/3
---

# seed the store, and migrate the rules that already exist, reversibly

D41 PHASE 4. Plan: docs/superpowers/plans/2026-09-10-d41-product-rule-store.md Tasks 14-16. Design: docs/superpowers/specs/2026-09-10-product-rule-store-design.md sections 4, 15.

OWNER RULING: migration happens ONCE, only when the store is production grade, and it must be
REVERSIBLE until proven. Not before.

AN ENTRY LIVES IN EXACTLY ONE PLACE. Each migrated rule moves and its corpus item is RETIRED with
a pointer - never copied, because a copy cannot be superseded and only the original can. That is
CLAUDE.md’s opening finding, measured on 2026-09-07 when five superseded instructions were being
acted on as current.

THE FIRST SEED ENTRY IS THE NUMBERING STANDARD, with a DETECTIVE check - and it was chosen because
its own history is the argument for the store: he asked for it, it went into a memory file, and
within the same conversation nothing could say whether it was being obeyed. Run its check over the
real archive and record the number.

Definitions are seeded from this project’s working vocabulary: lane, spill, stand down, the corpus,
known-red, the ration, a door, prove by removal.
