---
id: TASK-the-tutorial-manifest-and-the-surface-globs-it-derives-from
type: task
title: the tutorial manifest and the surface globs it derives from
status: active
severity: soft
always: false
summary: A generated manifest lists which CLI commands, UI screens, slash commands and categories each tutorial covers, and a test fails when a new one goes unclaimed.
summary_of: cbe4f8b551b902ce
scope:
  - src/core/**
  - docs/tutorials/**
  - scripts/**
tags:
  - v2
  - tutorials
  - ui
  - docs
  - "plan:tuts"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: d16c1cd2e7fb0f7a
plan: tuts
seq: "1"
state: todo
priority: "1"
---

# the tutorial manifest and the surface globs it derives from

Step 1 of six in docs/superpowers/plans/2026-09-05-tutorials-are-served-and-browsed.md, resting on docs/superpowers/specs/2026-09-05-tutorials-are-served-and-browsed-design.md. Read the spec before building.

Cluster four already-globbable surfaces -- src/cli/commands/*.ts (minus index.ts, registry.ts, format.ts), src/ui/public/screens/*.js (minus parts.js, tut.js, docs.js, learn.js), commands/*.md, and the 29 entries in src/core/categories.ts -- into a feature roster: one tutorial per feature, not per screen and not per command. Write it to docs/tutorials/manifest.json and check it in.

The coverage test globs the same four surfaces independently and asserts every file (except the carved-out meta screens and CLI plumbing) is claimed by exactly one manifest entry -- unclaimed or double-claimed both fail, naming the file. This is the step that turns the spec's rough estimate of twenty-five to thirty tutorials into a measured, countable number; nothing after this task may hand-type the roster.
