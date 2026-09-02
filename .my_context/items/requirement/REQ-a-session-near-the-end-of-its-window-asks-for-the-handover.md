---
id: REQ-a-session-near-the-end-of-its-window-asks-for-the-handover
type: requirement
title: a session near the end of its window asks for the handover to be updated, before it loses it
status: active
severity: hard
always: false
summary: When a working session is nearly out of room it asks for the handover notes to be written while it still can, and never guesses how full it is.
summary_of: e8a1dc8ffd3a5a2a
scope: []
tags:
  - v2
  - owner-requirement
  - hooks
  - continuity
  - handover
  - statusline
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: e2450457fec34190
kind: functional
---

# a session near the end of its window asks for the handover to be updated, before it loses it

OWNER REQUIREMENT, stated 2026-08-27: "use the most suitable hooks to measure the context window percentage occupacity, if 98 or greater update the handover file".

THE NUMBER ALREADY EXISTS AND IT IS CLAUDE CODE'S OWN. Nothing on any hook payload carries a token count -- the complete HookInput surface is 27 fields and not one of them is an occupancy signal. But the product already collects one: mycontext statusline tees Claude Code's status-line JSON per session, and classifyContext already returns { state, usedTokens, windowSize, percent }. This requirement is mostly built; what is missing is a hook that reads it and something that can act.

A HOOK CANNOT WRITE A HANDOVER. Only the model can. So the requirement is not "update the file" -- it is "ask the model to, at the last moment where it still can". The one registered per-turn event that can speak to the model is Stop, through the additionalContext envelope this project has deliberately left empty pending an owner ruling. His asking for this IS that ruling, taken narrowly: see DEC-stop-speaks-once-and-only-to-raise-the-handover.

IT NEVER GUESSES. context_window_size is not in the transcript, so a percentage derived from transcript arithmetic needs a model-to-window table that goes stale in silence. Under STD-absent-vs-zero an unmeasured thing is NAMED as unmeasured. If the status-line bridge is not installed the mechanism stands down and says so once -- it does not compute a number it cannot ground.

MEASURED 2026-08-27: the bridge is NOT installed on this machine. There is no .statusline directory in this corpus and ~/.claude/settings.json carries a statusLine belonging to a different plugin. Until the owner installs it this requirement is INERT, and that is stated here rather than discovered later. OPENQ-install-the-status-line-bridge-over-the-owner-s-current.

DONE WHEN, and all four:
1. Crossing the threshold produces exactly ONE ask, in one session, naming the handover path and the measured percentage.
2. No ask after the handover has been written, and none below the threshold. A loop in a per-turn hook is the most expensive bug this can ship.
3. With no bridge installed the mechanism stands down, once, on stderr, and never guesses a percentage.
4. PreCompact RECORDS the occupancy and the trigger of every compaction, so the threshold becomes a measurement rather than an argument.

Design: docs/superpowers/specs/2026-08-27-handover-continuity-across-compaction-design.md section 4. Plan: docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md.
