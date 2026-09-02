---
id: TASK-the-confirm-endpoint-computes-the-effect-so-every-boundary
type: task
title: the confirm endpoint computes the effect, so every boundary command can run
status: active
severity: soft
always: false
summary: Most commands that change things still cannot be run from the app, because only the server can work out what they would do.
summary_of: 3f5b3803edef92c8
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - "plan:execute"
  - "seq:5b"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: acd91a3824295f6b
plan: execute
seq: 5b
state: done
priority: "1"
source: "found building seq:6, 2026-08-27"
---

# the confirm endpoint computes the effect, so every boundary command can run

THE GAP BETWEEN WHAT WAS RULED AND WHAT SHIPPED, found while building plan:execute seq:6 and worth an owner decision.

Section 6.1 ruled that EVERY command in the catalogue runs, boundary-crossing ones behind a stronger confirm showing every field that changes, before -> after. Section 3.2 adds the constraint that makes that honest: "A command whose effect cannot be shown that way does not get a weaker confirm -- it does not run."

WHAT SHIPPED OBEYS 3.2 AND DOES NOT REACH 6.1. The confirm is rendered in the BROWSER, and a browser cannot derive what a command writes: that is the command's body, not its argument shape, and there is no build step to import it through. So `command-actions.js` declares a `COMMAND_EFFECTS` table covering `pin`, `unpin`, `harden`, `soften` and `edit` -- held honest by a test that imports `NAMED_ENTRY_POINTS` from `src/cli/commands/edit.ts` and fails entry by entry when the two disagree.

**Every OTHER boundary command is REFUSED**: `add`, `supersede`, `refresh`, `repair`, `review promote`, `review discard`, `review promote-revision`, `review discard-revision`, `inbox-promote`, `lesson-accept`. Refused rather than given a weaker confirm, which is correct under 3.2 -- and it means those still have to be pasted into a shell, which is the thing the owner said he wanted to end: "from the beginning i wanted to execute and not to copy".

THE FIX IS NOT A BIGGER TABLE IN THE BROWSER. It is that the DERIVATION IS ON THE WRONG SIDE. `GET /api/execute/confirm` already runs on the server, already resolves the command from the catalogue, and already has the corpus. It can compute the effect -- the fields, before and after -- and return it, and then the browser renders a diff it did not have to understand. The same move as `resolveCommand`: the boundary is enforced where the knowledge is.

WHAT THAT BUYS, beyond coverage: one spelling of every command's effect instead of two that can disagree; a diff computed against the corpus the command will actually touch rather than against a second read; and a browser that stays a renderer.

WHAT IT COSTS, stated: the confirm endpoint gets slower, and it becomes a place where computing an effect could throw -- which must fail as a REFUSAL to show the confirm, never as a confirm with an empty diff. An empty diff beside a command that changes something is the worst outcome available here.

DECIDE BEFORE BUILDING: whether the effect is computed by dry-running the real write path against a scratch copy, or by each command declaring its own effect the way `command-flags.ts` declares its flags. The second is the house pattern and the first is the only one that cannot drift.
