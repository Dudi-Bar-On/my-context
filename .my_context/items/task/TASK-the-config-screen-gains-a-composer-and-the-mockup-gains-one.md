---
id: TASK-the-config-screen-gains-a-composer-and-the-mockup-gains-one
type: task
title: the config screen gains a composer, and the mockup gains one first
status: active
severity: soft
always: false
summary: Give the settings screen controls that build the change for you to apply yourself; the design has to draw them first.
summary_of: b9f842157d6045c5
scope: []
tags:
  - v2
  - ui
  - "screen:config"
  - builder
  - mockup
  - "plan:walk"
  - "seq:13"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: c0780eeae9e2a8a3
plan: walk
seq: "13"
state: done
priority: "1"
source: owner requirement 2026-08-25
---

# the config screen gains a composer, and the mockup gains one first

Carries out the requirement that configuration is composed the way a command is.

THIS IS NOT A PARITY GAP. Measured 2026-08-25: the config screen has zero inputs, zero selects and zero placeholders ON BOTH SIDES. The design of record does not have this either, so the MOCKUP is where it starts -- the app cannot be 1:1 with a control the specification does not draw.

WHAT IT COMPOSES, and what it must never do: the screen produces the PATCH. The mockup s Apply this card already draws exactly that shape -- a diff of the config with - and + lines and a Copy the patch control -- and states the rule it obeys: "There is no command that edits a budget. Configuration is a file... changes are the user s to make - ask, do not edit." The composer makes the patch easy and legal to compose. Applying it stays the user s act.

THE THREE VALUES THE SCREEN ALREADY SHOWS ARE THE THREE SHAPES:
- `scopePolicy`: a closed set of three -> a SELECT, and the segbar already draws the positions.
- a budget: a positive integer with a shipped default -> free text, so it needs the explanatory sentence and the shipped value as its placeholder.
- `watchedDocs`: a list of globs, replace-never-merge -> free text per entry, and the replace-never-merge rule is exactly the kind of thing the explanatory text exists to say before someone loses a list.

USE THE DECLARATION THAT IS ALREADY BEING BUILT for the command builders (REQ-every-command-the-ui-offers-is-built-checked-before-it-can). Legal values drive the select, a format hint and an example drive the placeholder and the help, and both drive the check. Inventing a second catalogue for configuration is the failure mode this task is written to prevent.

Blocked on the mockup edit, which is the owner s.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, blocked on the owner, and plan:config seq:1 IS ITS SPECIFICATION. Take it into the sitting or the drawing arrives with no pane list.

seq:1 names the panes, from CATEGORY_KEYS and the top-level config shape: Profile, Categories (tier, prefix, description, extraFields, agentEdits, scopePolicy), Budgets, Watched documents -- each with its own heading, its own current value and its own settle step. And it measures what is there today: one flat page covering three of the seven things config.json carries, with a preview mixed into the middle.

plan:config seq:3 (the category wizard) and seq:4 (the paste hand-off) are the two flows inside it, and both are owner instructions of 2026-08-23. seq:4 s last paragraph is the acceptance test for the whole composer: the file already HAS a categories object, so the block is an entry inside it and not a top-level key -- getting that wrong produces invalid JSON and a refusal that reads like the wizard was wrong.

UNBLOCKED 2026-08-25 by DEC-claude-drafts-the-mockup-and-the-owner-approves. Dispatch WITH plan:config seq:1, which is its specification -- the pane list it would otherwise arrive without.
