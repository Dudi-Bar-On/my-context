---
id: TASK-five-commands-refuse-no-unknown-flag-so-nothing-can-check-a
type: task
title: five commands refuse no unknown flag, so nothing can check a command built for them
status: active
severity: soft
always: false
summary: Five commands accept any option without complaint, so nothing can verify a command built for them; either fix them or state the exception.
summary_of: 0e65eaac584d84a2
scope: []
tags:
  - "plan:builder"
  - "seq:1c"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: ad2955d841e70484
state: done
plan: builder
seq: 1c
needs: builder/1b
progress: "100"
last_change: 2026-08-31
---

# five commands refuse no unknown flag, so nothing can check a command built for them

Measured over all 38 commands by plan:builder seq:1: `ingest`, `ingest-apply`, `lesson-stage`, `lesson-accept` and `lesson-discard` have parsers ENTANGLED with execution - flags are read inline where they are used, and none of the five refuses an unknown flag at all. `palette-lib.test.ts`'s `NO_FLAG_PROBE` already records two of them as unreachable for exactly this reason.

WHY IT BLOCKS THE REQUIREMENT: REQ-every-command-the-ui-offers-is-built asks that copy be refused until the composed command passes the CLI's OWN parser. For these five there is no parser to pass. A builder could compose anything at all for them and no check could say otherwise.

This is a BEHAVIOUR CHANGE rather than a lift, which is why seq 1 correctly left it: giving a command a flag refusal it never had can break a caller that was passing something ignored. That is a real risk and needs its own measurement - grep the corpus, the skills and both READMEs for invocations of these five before deciding.

RULE FIRST, THEN BUILD: either these five gain parsers, or the requirement carries a named exception saying which commands cannot be checked and why. An unstated exception is the failure mode; a stated one is a design.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is the one task in this plan that is a BEHAVIOUR CHANGE rather than a lift -- which is why it must not be folded into seq:3 by whoever builds the catalogue. ingest, ingest-apply, lesson-stage, lesson-accept and lesson-discard read flags inline where they are used and none refuses an unknown flag, so REQ-every-command-the-ui-offers-is-built cannot be satisfied for them: there is no parser to pass. Its own risk note is the method and should be followed literally -- grep the corpus, the skills and both READMEs for invocations of these five before deciding, because giving a command a flag refusal it never had can break a caller that was passing something ignored.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.
