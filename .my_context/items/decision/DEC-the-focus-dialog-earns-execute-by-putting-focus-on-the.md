---
id: DEC-the-focus-dialog-earns-execute-by-putting-focus-on-the
type: decision
title: The focus dialog earns Execute by putting focus on the approval boundary, not by an exemption
status: active
severity: soft
always: false
summary: Focus should earn its Execute button by accepting a confirmation flag like every other command, rather than by being excused from the rule.
summary_of: ca676647b0fc18b1
scope: []
tags:
  - ui
  - focus
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 7c72d1d80a7efd0b
---

# The focus dialog earns Execute by putting focus on the approval boundary, not by an exemption

Owner ruling, 2026-09-02, chosen from three options as the recommended one. His selection, verbatim: "Give the CLI command a --yes flag, which puts focus on the approval boundary and lets the shared control render Execute. Fixes the general case: any screen composing a focus command gets Execute, and the boundary stays derived rather than listed."

Rejected with it: leaving the dialog Copy-only, and an OFF_BOUNDARY exemption to obtain the button.

WHY THE DIALOG DRAWS COPY TODAY, AND IT IS A CHAIN RATHER THAN AN OVERSIGHT

The approval boundary is PROBED, never listed. `gatedCommands` runs the real CLI in a throwaway workspace and records a command as gated only when it refuses without `--yes`. `mycontext focus` accepts no `--yes`, so the probe does not place it on the boundary, so it has no catalogue entry, so `commandActions` receives `id: null` and returns before the Execute button is ever constructed. Every link is doing its job.

WHAT MOVES WHEN THIS LANDS

Adding `yes` to the focus flag declaration makes the probe find it, which grows `denyRequired`, which turns the catalogue parity test red until either a palette entry exists or a written NOT_IN_PALETTE reason does. The dialog then passes a real catalogue id instead of null. Both READMEs carry a DERIVED count of the commands that change what governs the project, so that number moves in two languages, and a browser assertion that the control reads Copy has to be re-taken deliberately rather than adjusted.

THE CONTRADICTION THIS RULING CONTAINS, AND IT IS FOR THE OWNER

The boundary is defined as the set of commands that change what governs this project with no human in the loop. `mycontext focus` writes `state/focus.json`, which is gitignored and machine-local and governs no other reader - the same shape as `statusline install`, which is the reason an OUTSIDE_BOUNDARY list exists at all. So the honest placement may be OUTSIDE the boundary, and the owner rejected an off-boundary exemption as the route to the button. Those two facts have to be reconciled before code moves.

A SECOND QUESTION THE RULING DOES NOT REACH. The dialog composes THREE lines: `--clear` and `--tag <tags>` are writes, and `--show` is a read that changes nothing. One catalogue entry carrying `--yes` would put a confirmation in front of a command that reports.

WHAT THIS DOES NOT CHANGE

`packs`, `port` and `proc` keep `id: null` and that is settled by its own decision, each for a reason of its own. The focus ruling opens the same route to them; it does not oblige them onto it.
