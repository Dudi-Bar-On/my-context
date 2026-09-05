---
id: TASK-the-ui-slash-command-and-the-cli-command-behind-it-which
type: task
title: the ui slash command and the CLI command behind it, which write config.json
status: active
severity: soft
always: false
summary: A command a person types to switch the web view on, and the first thing in the product allowed to edit the settings file.
summary_of: 2abbf11cf0ee3b56
scope: []
tags:
  - "plan:rulings"
  - "seq:20"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 3c33e24e7acb6577
plan: rulings
seq: "20"
state: done
progress: "0"
priority: "2"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T14:14:56Z"
needs: rulings/42
verified_on: 2026-09-05
---

# the ui slash command and the CLI command behind it, which write config.json

Ruling R14.1. This is the FIRST write path to config.json in the product, and the precedent is being set on purpose.

A slash command is the user typing it, not an agent acting. The project already drew this line: cli/commands/review.ts calls updateItem with origin 'human' after a confirmation, defended as a human took it, at their terminal, one prompt ago. The PreToolUse deny hook keeps stopping AGENTS from editing config.json and must stay exactly as it is.

Depends on the config task: there is no ui key to toggle until that lands. The 70-odd existing slash commands are GENERATED - see scripts/gen-commands.ts and npm run gen:commands - so the new one is generated too, not hand-written.

Confirm before writing, and preserve everything else in the file byte-for-byte: a toggle that reformats a user's config is a toggle nobody trusts twice.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. Ruling R14-family work, untouched since 2026-08-20, and nothing in the UI plans supersedes it.

ONE THING THE RECONCILIATION ADDS, and it changes the order: this task builds the command that WRITES ui.enabled into config.json, and plan:rulings seq:42 has just established that NOTHING READS IT -- verified live. Building a writer for a key no reader honours ships a control that does nothing, which is the same defect one layer out. SETTLE seq:42 FIRST.

It also touches DEC-should-the-web-ui-be-allowed-to-write-config-json, which the config plan answers with "it composes, it does not write". A CLI command writing config.json is a different actor and is not covered by that decision -- worth saying explicitly when it is built, because the next reader will assume it is.
