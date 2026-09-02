---
id: DEC-a-budget-is-chosen-by-simulating-it-and-carried-to-config
type: decision
title: a budget is chosen by simulating it, and carried to config from there
status: active
severity: soft
always: false
summary: A limit is chosen by trying it out and seeing what it pushes out, then carried into the settings; one control does both, so nobody changes the wrong one.
summary_of: bea88d38190f6f21
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - "screen:config"
  - "screen:simulate"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 2f7449a8df34fe28
---

# a budget is chosen by simulating it, and carried to config from there

OWNER RULING, 2026-08-25, in the config walkthrough. The owner first proposed a slider on the config screen and then improved on it: "or may be entered from the simulator screen after success simulation".

THE RULING: there is ONE budget slider and it stays on simulate. A successful simulation can be carried to config, where it becomes a pending line in the patch.

WHY NOT A SECOND SLIDER ON CONFIG. The control already exists -- `<input type="range" id="slider" min="0" max="12000" step="50">` beside the tier picker -- in the mockup and in the app. A second one on config would be two identical-looking controls meaning different things: one a what-if, one a real change. The day somebody drags the wrong one they believe they changed their config when they did not, or the reverse.

WHAT IT GIVES BOTH SCREENS, and neither has it today:
- simulate stops being a curiosity. The staircase shows what fits and where raising a budget EVICTS, and then the reader can act on what they learned. You pick a rung and that rung becomes the patch.
- config s "What changes" plate stops being empty for want of an edit in flight. THE SIMULATION IS THE EDIT IN FLIGHT -- the plate exists to show `STD-api-errors... spilled -> delivered`, which is exactly what the simulation computed.

AFTER A SUCCESSFUL SIMULATION, and the word is load-bearing: a budget that was never evaluated cannot be carried. The number arrives at config already having been shown to work.

TWO SUB-RULINGS taken with it:
- CONFIG ACCUMULATES. Each carried simulation adds or replaces one tier s line and the patch grows, because budgets are related and retuning jit usually means retuning restored too. Weighed against: one-at-a-time is simpler and matches the mockup s single-line patch, but it sends a person to the file three times.
- THE VALUE TRAVELS IN THE URL, beside the screen name the hash already routes, so a pending change survives a reload and the proposed patch can be handed to someone as a link. Weighed against: in-memory leaks nothing into history, and loses unapplied work on refresh.

NOTHING HERE WRITES. config still composes a patch the human applies; the deny hook is untouched.
