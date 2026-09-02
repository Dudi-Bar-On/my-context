---
id: OPENQ-install-the-status-line-bridge-over-the-owner-s-current
type: open_question
title: install the status-line bridge over the owner’s current status line, or leave the occupancy requirement inert?
status: active
severity: soft
always: false
summary: Should the tool take over the bar at the foot of the screen to get a reading it needs, or should the feature that needs it stay switched off?
summary_of: fd83f2e1b43a0708
scope: []
tags:
  - v2
  - owner-question
  - statusline
  - handover
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: efe51fff056c1fee
blocks: the occupancy requirement measuring anything at all
---

# install the status-line bridge over the owner’s current status line, or leave the occupancy requirement inert?

MEASURED 2026-08-27: mycontext's status-line bridge is NOT installed on this machine. There is no .statusline directory in this corpus, and ~/.claude/settings.json carries a statusLine pointing at a different plugin's script.

THE BRIDGE IS THE ONLY GROUNDED SOURCE OF THE OCCUPANCY FIGURE. classifyContext computes percent from context_window_size and the three current_usage token fields, both of which arrive on Claude Code's own status-line payload. context_window_size is NOT in the transcript, so there is no honest fallback: deriving a percentage from transcript arithmetic needs a model-to-window table, and such a table goes stale in silence. Under STD-absent-vs-zero the mechanism therefore stands down and says so rather than guessing.

WHAT INSTALLING COSTS. mycontext statusline install prints the existing statusLine in full and replaces it only on --yes, saving the previous value so uninstall restores it. So nothing is lost and nothing is silent -- but it is the owner's screen, and the status line he sees would become mycontext's.

THE THREE ANSWERS:
- INSTALL. The occupancy requirement works; his current status line is replaced and restorable.
- LEAVE IT. The requirement ships inert and discloses that it is, once per session, on stderr. Everything else in the handover work still functions.
- CHAIN. Neither exists today: the bridge replaces rather than delegates. Making it tee AND pass through to a previous status line is a real change to that command and is not in either plan.

Design: docs/superpowers/specs/2026-08-27-handover-continuity-across-compaction-design.md section 7.
