---
id: TASK-mycontext-conversation-export-on-the-approval-boundary
type: task
title: mycontext conversation export, on the approval boundary
status: active
severity: soft
always: false
summary: A reader looking at a conversation can take a copy of it, through the same consent gate every other write uses.
summary_of: 2dada292d64ad232
scope:
  - src/cli/commands/**
  - src/ui/public/screens/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 37dba2be1f3c7403
plan: archive
seq: "4"
state: todo
priority: "2"
---

# mycontext conversation export, on the approval boundary

Step 4 of five in docs/superpowers/specs/2026-09-04-conversation-archive-design.md.

The owner asked for this while looking at a conversation: let him take a copy. It writes a
file outside the workspace, so it belongs on the approval boundary with the rest of the write
surface.

The boundary is DERIVED by probing which commands refuse without consent, never declared in a
list, so this joins it by BEHAVING like a write rather than by being added anywhere. Read
test/helpers/approval-boundary.ts before choosing a consent shape.

Consent shape matters and this project distinguishes them: --yes is for a command performing
one write, while a command acting on N items uses --count, because stating the number IS the
agreement. Pick correctly and say why.

The spec titles this step composed, never run. That phrasing predates the owner’s ruling of
2026-09-04 that web screens MAY write, so do not inherit a restriction he has lifted - but do
not silently drop the protections either. Say what you chose.
