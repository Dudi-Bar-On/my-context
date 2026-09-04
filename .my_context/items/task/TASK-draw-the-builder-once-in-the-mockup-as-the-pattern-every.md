---
id: TASK-draw-the-builder-once-in-the-mockup-as-the-pattern-every
type: task
title: draw the builder once in the mockup, as the pattern every command site uses
status: active
severity: soft
always: false
summary: Draw the command-building form once in the design, so every screen offering a command copies one agreed pattern instead of inventing its own.
summary_of: b2e0fc765cea173f
scope: []
tags:
  - v2
  - ui
  - builder
  - mockup
  - owner-input
  - "plan:walk"
  - "seq:20"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 43890997ab707ba4
plan: walk
seq: "20"
state: todo
priority: "1"
source: "plan:port seq:98, capture and palette"
---

# draw the builder once in the mockup, as the pattern every command site uses

Carries out the ruling that the mockup draws the builder once.

THE MOCKUP BELONGS TO THE OWNER, so this is the owner s to draw. What it has to settle, because three screens and every future command site will copy it:
- a SELECT for a value with a closed set, and what it looks like disabled
- an INPUT for free text, with its placeholder and its help affordance -- both required by REQ-every-command-the-ui-offers-is-built-checked and by REQ-configuration-is-composed-the-way-a-command-is
- the state of the COPY control while the command is incomplete. The Capture screen already behaves correctly here -- `captureCommand` THROWS on a half-built capture so there is no `.cmd` row and nothing to copy -- and the pattern should draw what that looks like rather than leaving each screen to decide
- the composed `.cmd` row itself, which already exists on several screens

WHAT INSTANTIATES IT TODAY: capture, palette, and config (plan:walk seq:13). What will: every command site the builder requirement converts.

DO NOT draw it as a new screen. It is a pattern inside the design of record, referenced by the screens that use it, which is the whole point of drawing it once.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, blocked on the owner, and plan:builder seq:5 IS ITS OTHER HALF. Neither names the other.

seq:5 says "THE MOCKUP IS THE DESIGN OF RECORD AND MUST MOVE FIRST ... Draw it in the mockup, then build it, in one parity-locked commit". This task is that drawing. DO NOT HOLD THE MOCKUP SITTING WITHOUT seq:5 IN HAND -- it carries what must be drawn: a closed vocabulary becomes a select, free text becomes an input CARRYING ITS FORMAT AS A PLACEHOLDER (owner instruction 2026-08-24, "a grayed out hint in the fields as placeholder before user enter values"), and a required field that is empty is VISIBLY required.

And screens/capture.js is the model to generalise from, not to replace -- it already does most of this.

UNBLOCKED 2026-08-25 by DEC-claude-drafts-the-mockup-and-the-owner-approves. It was blocked because the mockup is the owner s file. Claude now drafts it and the owner approves; the 1:1 rule is untouched. Dispatch WITH plan:builder seq:5, which carries what must be drawn.
