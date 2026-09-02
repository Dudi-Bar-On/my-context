---
id: REQ-a-pinned-item-is-delivered-or-the-user-is-told-it-was-not
type: requirement
title: a pinned item is delivered or the user is told it was not
status: active
severity: soft
always: false
summary: Anything marked to be shown every time must arrive, and when it does not, the person is told by name which one went missing and why.
summary_of: aeb61bf98dc109e9
scope: []
tags:
  - v2
  - owner-requirement
  - injection
  - budgets
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: b9317fc8f0c2cbb6
kind: functional
---

# a pinned item is delivered or the user is told it was not

OWNER REQUIREMENT, 2026-08-27: "pinned are first priority to stay in context so if they can not be injected i want to 1: recommend to raise up the budget and 2: show it to the user, notify him, popup message with his budget selection should appear, give him several recommended budgets to select from and also let him freely enter his own number, you should only validate that it is not greater than what is possible and if the situation is that the context window is full let him know and say that this injection requires a compact or clear before it could be done, in this case you should set the new budget and the pinned items will be injected after the compact or clear happens".

THE MEASUREMENT THAT PROMPTED IT, and it was WRONG the first time — recorded here because the correction is the more useful half.

WHAT WAS OBSERVED, and is true: the newest SessionStart delivered **16 of 23** pinned items, and nothing said so.

WHAT WAS CLAIMED, and is false: that the pinned tier cost 17,237 tokens against a 16,000 budget and therefore spilled. That figure came from RAW FILE BYTES including frontmatter, over 23 items including one that is superseded. **The shipped estimator says 14,876 against 16,000 — 93%. Nothing spills.** A measurement taken with a different instrument from the one the product uses is not a measurement of the product, and it sent this requirement's first draft at the wrong cause.

THE ACTUAL CAUSE of the seven is an active FOCUS that silently overrides `always: true` — see KNOWN-a-focus-silently-overrides-always-true-so-a-pinned-item and plan:budget seq:1b.

**THE REQUIREMENT SURVIVES THE CORRECTION INTACT**, and that is why it is still here: a pinned item that does not reach a session is a broken promise however it was lost, and NOTHING SAID SO in either case. The budget path was built (seq:1) and is correct; it simply does not fire on this corpus today. The focus path is seq:1b.

WHAT MUST BE TRUE:

1. **A PINNED ITEM THAT IS NOT DELIVERED IS DISCLOSED, NAMED, AND RECORDED** — by id, never by count, on stderr at SessionStart and as its own field on the injection audit row. Whatever dropped it: a budget, a focus, a status. This is the floor and it ships first.
2. **The recommendation comes with the numbers**, not the advice: what the tier costs, what it is set to, what it would have to be.
3. **The user chooses, in the UI.** Several recommended budgets plus free entry. The UI WRITES it — DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to.
4. **VALIDATION IS AGAINST THE WHOLE WINDOW.** `pinned + jit + restored + index` must fit `context_window_size`; a budget that individually passes while the four together do not is refused. The window size is known only when the status-line bridge has spoken — **without it, refuse to validate rather than guess a ceiling.**
5. **A FULL WINDOW IS A STATE, NOT A FAILURE.** Say it needs a compact or a clear, and set the new budget anyway: budgets are read at SessionStart, which is exactly when a compact or clear produces one.

ON "POPUP", stated rather than promised away: the product cannot raise a dialog in Claude Code. It can reach stderr at SessionStart — which the user sees in the terminal — and the web UI, which he sees only if it is open. The terminal one is the only channel guaranteed to arrive.
