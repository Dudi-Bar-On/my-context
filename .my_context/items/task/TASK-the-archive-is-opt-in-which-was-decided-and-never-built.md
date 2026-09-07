---
id: TASK-the-archive-is-opt-in-which-was-decided-and-never-built
type: task
title: the archive is opt-in, which was decided and never built
status: active
severity: soft
always: false
summary: A project chooses whether to keep a conversation archive at all; today every project has one whether it wanted it or not.
summary_of: a3ad95eeaacd3eed
scope:
  - src/ui/**
  - src/core/conversation-index.ts
  - e2e/**
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:9"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 64169ea99efaf282
plan: archive
seq: "9"
state: todo
priority: "1"
---

# the archive is opt-in, which was decided and never built

The design spec settles this in a section that opens with the decision already taken: "the whole
thing is OPT-IN: a project either turns this on or works exactly as it does today ... One key,
defaulting to OFF ... A project that does not turn it on behaves exactly as it does today, AND
NOTHING SCANS A TRANSCRIPT."

THERE IS NO SUCH KEY. Config in src/core/config.ts carries profile, categories, budgets, watchedDocs,
ui, handover, dispatchGate and skippedKeys - and nothing else. The screen is in the rail for every
project, the routes always register, and mycontext conversation rebuild always scans. A conversation
key written into a config file today would land in skippedKeys as unknown.

THIS IS THE ONE SECTION OF THE DESIGN WITH NO LINE OF CODE BEHIND IT, and none of the six archive
items restates it - the requirement existed only in the spec. That is exactly
LESSON-a-requirement-given-in-conversation-and-never-captured-is-a one layer up: captured in a spec,
then not carried into the tasks that were actually dispatched.

IT MATTERS MORE THAN A SETTING. Scanning transcripts is the one thing this product does that reads
outside its own workspace, and the spec names the security consequence in the same breath (see
plan:archive seq:11). Off by default is the whole mitigation.
