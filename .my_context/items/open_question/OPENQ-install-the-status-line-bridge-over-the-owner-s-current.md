---
id: OPENQ-install-the-status-line-bridge-over-the-owner-s-current
type: open_question
title: install the status-line bridge over the owner’s current status line, or leave the occupancy requirement inert?
status: deprecated
severity: soft
always: false
summary: Should the tool take over the bar at the foot of the screen to get a reading it needs, or should the feature that needs it stay switched off?
summary_of: 0325af60b30672f9
acknowledged:
  - open_question_blocks@f12fd0e31f6482a8
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
valid_until: 2026-09-08
checksum: 73e40fa41875d808
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

THIS QUESTION IS STALE AND THE WORLD HAS ANSWERED IT. Re-measured 2026-09-08 on the same machine.

THE BRIDGE IS INSTALLED. `~/.claude/settings.json` carries
`statusLine.command = node ... my-context/src/cli/index.ts statusline` with a 60 s refresh - not a
different plugin script, which is what the 2026-08-27 measurement above found. `.my_context/.statusline/`
exists and holds a live tee per session.

AND THE OCCUPANCY REQUIREMENT IS NOT INERT. The tee for the session current at the time of writing
carries `context_window.used_percentage: 25` against a `context_window_size` of 1,000,000, with all
four token fields present. So the figure the whole handover mechanism depends on is being read
live, and has been.

ONE SHAPE NOTE, because it is the trap a future reader will hit: the payload nests the window under
`context_window`, and `src/core/statusline-tee.ts` reads it there. A synthetic payload written with
those fields at the TOP level - which is how this item and the design doc both describe them -
renders `ctx - unreadable` and looks exactly like a broken bridge. It is not; it is the wrong
fixture shape.

SO THE THREE ANSWERS THE ITEM OFFERED HAVE ALL LAPSED: there is nothing to install, nothing of the
owner's to preserve, and no requirement standing inert. The only question left is a preference -
whether he wants anything changed about what the bar shows - and that is not this question.
