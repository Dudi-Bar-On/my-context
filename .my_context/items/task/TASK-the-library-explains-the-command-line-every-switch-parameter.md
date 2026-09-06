---
id: TASK-the-library-explains-the-command-line-every-switch-parameter
type: task
title: "the library explains the command line: every switch, parameter and option, with examples"
status: active
severity: soft
always: false
summary: A reader can look up any command or flag and get a plain explanation and a worked example without leaving the console.
summary_of: b6e41ce84361283f
scope:
  - src/ui/public/screens/library.js
  - src/help/**
  - src/core/command-flags.ts
tags:
  - v2
  - ui
  - library
  - docs
  - "plan:library"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 5d8192d4908be141
plan: library
seq: "1"
state: done
priority: "3"
verified_on: 2026-09-06
---

# the library explains the command line: every switch, parameter and option, with examples

Owner requirement 2026-09-06 (plan D13, first half).

WHAT HE ASKED FOR: the command-line help, structured and explained, with examples and simple
explanations. Every switch, parameter and option explained. A selection box so a reader can ask
for help on a specific subject - a command, a slash command, and so on - rather than scrolling.

MOST OF THE DATA ALREADY EXISTS AND IS DERIVED, which is what makes this affordable:

  COMMAND_FLAGS (src/core/command-flags.ts)   146 flag declarations across 34 commands, and it
                                              is what the commands themselves parse against
  src/help/topics/*.md                        8 files: capture, categories (EN+HE), cli, scope,
                                              slash, tools, workflow
  the command registry                        43 commands
  commands/*.md                               90 slash commands
  src/mcp/tools.ts                            25 tools, each with its own schema and description

THE GAP TO CLOSE FIRST, measured: 34 of 43 commands declare flags in COMMAND_FLAGS. Nine do not.
"Every switch explained" is not reachable until it is known whether those nine genuinely take no
flags or simply were never declared, and the answer decides whether this is a presentation task
or a registry task as well.

DERIVED, NEVER TYPED. A flag list spelled into a screen is the drift this project measures in
days - the command catalogue said "38 commands" and was right on 2026-08-24. Read the registry,
the topics and the tool schemas at runtime.

THE HARD PART IS THE EXAMPLES, and it should be said plainly before anyone starts. A worked
example is prose, and prose is what goes stale here: five documentation-review findings sat under
headings a checker had ticked. gen-doc-examples.ts already solves this for the READMEs by RUNNING
the real command against a committed fixture and pasting the true output. Whatever is built should
reuse that mechanism rather than invent hand-written examples that nothing re-runs.

AND IT IS TWO SURFACES, not one. `mycontext help <topic>` already serves seven topics on the CLI,
and the MCP tool withholds one of them by design (MCP_HELP_TOPICS filters out `cli`). Whatever the
Library shows must agree with those or say why it differs.
