---
id: TASK-drive-capture-into-its-composed-state-and-close-four-ledger
type: task
title: drive Capture into its composed state, and close four ledger entries at once
status: active
severity: soft
always: false
summary: A test never types anything, so it judges a blank screen and records four differences that do not exist; make it reach the real state first.
summary_of: 43ca389d193d9cd0
scope: []
tags:
  - v2
  - e2e
  - capture
  - gates
  - "plan:walk"
  - "seq:55"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: d108292cde6aa5ba
plan: walk
seq: "55"
state: todo
priority: "2"
source: "found 2026-08-27 closing plan:execute seq:6b"
---

# drive Capture into its composed state, and close four ledger entries at once

`e2e/screen-parity.spec.ts` records four accepted gaps on `capture` — `div.cmd`, `code`, `button` and `p.cmdnote` — and all four have ONE cause: nothing below Capture's inputs renders until a category and a title are typed. The walk never types, so it never reaches the state, so it judges an empty screen and calls the difference a gap.

**A WALK THAT NEVER REACHES A STATE CANNOT JUDGE IT**, and this is the second surface where that has cost something today. `e2e/button-contrast.spec.ts` hit it first: written, green, and then the owner's real defect was REINTRODUCED and it still passed, because the Composer builds nothing until a command is composed. The remedy there is `composeOnPalette` — select a command with no required arguments, wait for the control to exist, then measure. `button-contrast.spec.ts` additionally lists `capture` in `EXPECTED_EMPTY` for exactly this reason, so **two gates are currently blind to the same screen for the same cause**.

WHAT TO BUILD: the equivalent typing step. Enter a category and a title, wait for `div.cmd` to exist, and only then collect. Then DELETE the four entries from `KNOWN_GAPS['capture']` — the gate's own message says a closed gap must have its entry removed, and it fails in that direction too, so leaving them would be a second failure. And remove `capture` from `button-contrast`'s `EXPECTED_EMPTY` in the same change, because the reason it is there stops being true.

WHAT NOT TO DO: do not make Capture draw its command block unconditionally. `capture-screen.test.ts` pins the refusal — *"the screen honours the throw by offering no copyable command at all"* — and drawing the block anyway would offer a Copy for a command that does not exist. **The screen is right; the walk is what is short.**

RELATED, and already fixed: two of those four only became visible as gaps when `[hidden]` started working. `.cmd{display:flex}` is an author rule and beat the UA's `[hidden]{display:none}`, so `cmd.hidden = true` set the attribute and changed nothing — an empty command box sat on screen for every capture nobody had typed. `.cmd[hidden]{display:none}` fixes it, and the ledger got LONGER as a result, which is the honest direction.
