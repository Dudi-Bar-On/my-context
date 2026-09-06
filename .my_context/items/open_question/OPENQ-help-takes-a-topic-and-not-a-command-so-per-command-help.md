---
id: OPENQ-help-takes-a-topic-and-not-a-command-so-per-command-help
type: open_question
title: help takes a topic and not a command, so per-command help exists in the web UI and nowhere else
status: active
severity: soft
always: false
summary: Asking the tool to explain one specific command works on the screen but not at the command line.
summary_of: ec0bf7b0640a337b
scope:
  - src/help/**
  - src/cli/index.ts
tags:
  - v2
  - cli
  - help
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 0eea1a3de1728021
---

# help takes a topic and not a command, so per-command help exists in the web UI and nowhere else

Owner question 2026-09-06: he ran `help slash` in the Composer, got a list of every slash command,
and asked whether help takes more parameters - help for ONE command - and if so why the Composer
does not offer that input.

MEASURED ANSWER: the Composer is faithful; the CLI has no such parameter. `mycontext help [topic]`
takes a TOPIC from a closed set of seven - categories, scope, capture, workflow, cli, tools, slash.
`mycontext help show` is refused in as many words: ‘"topic" must be one of … You passed "show".’
So `topic` is the only parameter, the Composer offers exactly it (D10 gave it a picker over
HELP_TOPICS, the whole list), and `help slash` returning every slash command is that topic doing its
job rather than a missing filter.

BUT THE INSTINCT BEHIND THE QUESTION IS CORRECT AND POINTS SOMEWHERE ELSE: there is no per-command
help ANYWHERE in the CLI. Not a missing flag - a missing capability.

AND IT NOW EXISTS ON EXACTLY ONE SURFACE. `library/1` landed the same day: the Library screen
explains every command, every switch and every parameter with worked examples and a picker, served
from `/api/cli-help`, derived from the registry at request time. So the product can answer "explain
`show` to me" in the browser and cannot answer it in the terminal.

THE QUESTION FOR THE OWNER: does `help` grow a second shape - `mycontext help <command>` beside
`mycontext help <topic>` - reading the same derived data `/api/cli-help` reads? The data layer is
already built and already derived, so this is a CLI surface question rather than a content one. Two
costs to weigh: `topic` and `command` share one positional slot, so the enum refusal above would
have to become a two-stage lookup and its error message rewritten; and `MCP_HELP_TOPICS` withholds
`cli` from the MCP surface by design, so a third surface widening the same verb needs its own answer
on what it withholds.

HIS OWN BROADER SUSPICION - "it may be relevant for all the commands in general" - is already filed
as `builder/3`, the bidirectional catalogue test: does the Composer catalogue cover every command
and every parameter the product actually has, checked in both directions rather than asserted. That
item is ready and undispatched, and it is the systematic form of this one question.
