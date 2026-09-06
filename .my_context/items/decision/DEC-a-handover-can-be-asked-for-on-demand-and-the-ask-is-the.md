---
id: DEC-a-handover-can-be-asked-for-on-demand-and-the-ask-is-the
type: decision
title: a handover can be asked for on demand, and the ask is the vocabulary on all three surfaces
status: active
severity: soft
always: false
summary: Someone who wants to wrap up early can say so, and the system treats that the same as its own request.
summary_of: b7cc9c287b762d3e
scope:
  - src/core/handover-ask.ts
  - src/cli/**
  - commands/**
  - src/mcp/**
tags:
  - v2
  - handover
  - cli
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: daacb6df11d96d80
---

# a handover can be asked for on demand, and the ask is the vocabulary on all three surfaces

Owner ruling 2026-09-06, answering OPENQ-nothing-triggers-a-handover-on-demand-and-a-handover-written.

CHOSEN: shape (a) - a command that ASKS, rather than (b) a sixth verdict for a file written with no
ask behind it. The latch records an ask and `acted-on` means ordering against one; firing the same
ask the Stop hook fires, at whatever the occupancy is, keeps one vocabulary and leaves every
downstream reader unchanged. (b) would have widened a type five call sites read in order to describe
the same fact.

AND ON ALL THREE SURFACES, owner instruction, in as many words: a CLI command, a slash command and
an MCP tool, all triggering a handover update on demand.

THE CONSEQUENCE THAT MAKES THIS ONE FEATURE RATHER THAN THREE: the three surfaces are ENTRY POINTS,
not implementations. The decision to ask, the occupancy it stamps, and the refusals all live once in
src/core/. A surface that re-derives any of that is the drift this project measures in days.

NOT IN SCOPE, and deliberately: handover/11 wants the opposite control on the same surface - keeping
the handover injected while turning the automatic ask OFF. It is not being built here. Whatever
command shape lands must not foreclose it, and should say how it would extend.
