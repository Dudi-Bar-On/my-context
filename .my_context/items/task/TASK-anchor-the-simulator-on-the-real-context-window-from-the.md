---
id: TASK-anchor-the-simulator-on-the-real-context-window-from-the
type: task
title: anchor the simulator on the real context window, from the status line
status: active
severity: soft
always: false
summary: The simulator’s staircase says how much room is left, read from the real window rather than a typed number.
summary_of: b9f938fd0fb22bc0
summary_was:
  - 2026-09-07 Show the room actually left in the conversation on the what-fits chart, so the setting stops being an abstract number, and say when it is unknown.
acknowledged:
  - body_disagrees_with_meta@d65086b9b1335fa5
scope: []
tags:
  - v2
  - ui
  - "screen:simulate"
  - statusline
  - "plan:walk"
  - "seq:8"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: d545f807fdd1606d
plan: walk
seq: "8"
state: todo
priority: "2"
needs: walk/7
source: owner idea 2026-08-24, simulate walkthrough
---

# anchor the simulator on the real context window, from the status line

OWNER IDEA, 2026-08-24, accepted in the simulate walkthrough and sequenced AFTER the staircase: a marker needs a chart to sit on.

THE POINT: the budget slider is an abstract number today. Anchored on the status line it becomes a marker at the room actually left in the context window -- drawn the way the mockup already draws its eviction line -- and "what fits" stops being hypothetical.

THE DATA IS ALREADY PLUMBED, which is why this is cheaper than it looks. `statusline.ts` derives `windowSize` from Claude Code s `context_window.context_window_size`, `usedTokens` as input plus cache_creation plus cache_read, the percentage, and `myctx.tokens` -- how much of that window my_context itself put there. `statusline-tee.ts` already WRITES that sample to disk for the web UI to read, joined on session_id. Nothing new has to be collected.

THREE HONESTY CONSTRAINTS, and each one is a rule this project already enforces:
1. The sample has THREE states -- known, not-yet-known (no API call since the last compact), and unknown (this Claude Code sends no context_window). In two of them the marker is ABSENT AND NAMED. It is never guessed and never drawn at a default.
2. `usedTokens` is the WHOLE session -- files read, tool output, conversation -- and not my_context s share. Free space is real but it moves every turn. It is a marker, not a budget.
3. A tier budget and free window space are DIFFERENT UNITS OF DECISION. The budget asks how much to spend on a tier; free space says what that budget could be. The marker informs the slider and must not quietly become it.

Unblocked 2026-08-28: plan:walk seq:7 landed (commit 3a096ff) and its gates are green — typecheck clean, 5061 unit tests, the four static gates, and the browser suite once div.at was restored to the parity ledger.

RE-CUT 2026-09-07 by owner ruling (plan:walk seq:140, option A). What follows narrows this
item; everything above it is the record of why.

HALF CLOSED — "anchor it and say when it is unknown", against plan:budget seq:3 and seq:4, which
answered it.

SURVIVES: the free-space line on the staircase, and only that.
WORDING CORRECTED 2026-09-08. This body opened a line with a verdict word - CLOSED, BLOCKED - to
mean that ONE HALF of the item was settled, on an item that remains open. `body_disagrees_with_meta`
read it as the item’s own verdict and was right to: a reader skimming sees the word before the
qualifier. The half is still settled; only the wording moved.
