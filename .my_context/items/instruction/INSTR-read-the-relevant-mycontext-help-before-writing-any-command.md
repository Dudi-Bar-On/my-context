---
id: INSTR-read-the-relevant-mycontext-help-before-writing-any-command
type: instruction
title: read the relevant mycontext help before writing any command or MCP call
status: active
severity: hard
always: true
summary: Read the help for the exact surface you are about to use before writing a command, every time; a nearly right guess costs more than an obviously wrong one.
summary_of: 27ca6b058afd5388
scope: []
tags:
  - workflow
  - cli
  - syntax
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 46c2d11935e78992
---

# read the relevant mycontext help before writing any command or MCP call

**Before writing any `mycontext` command or MCP call, read the relevant help. Every time. The help is the syntax of record; your memory of it is not.**

**Where to look, and it is one call. The topic follows the SURFACE you are about to use:**

- `mycontext help cli` — the CLI: commands, flags, argument order.
- `mycontext help tools` — the MCP tools: every option and switch, what each one stamps, and what it refuses.
- `mycontext help slash` — the slash commands, and which CLI call each one stands for.
- `mycontext help` — the topic list, for when you do not yet know which surface you want.
- Read any of them from either side: `mycontext help <topic>` from the CLI, `mycontext_help("<topic>")` from the MCP server.
- `mycontext <command>` with no arguments, or with a wrong flag, prints that command's own usage. That is the fastest answer to "what flags does this take".

**This is not caution, it is a measured cost.** In one session the assistant made three syntax errors that the help answers outright:

- `add rule "…" --always` — **`add` has no `--always` flag.** It is on `edit`. The command failed and had to be re-run.
- `link <id> refines <id>` — **there is no `link` command.** Relations are set through the MCP `create_item` / `link_items` tools; the CLI has no spelling for them.
- `supersede <id> --reason …` — **`supersede` requires `--by <replacement id>`.** Called without it, it prints usage and does nothing.

Each cost a round trip. None was a hard problem; each was a guess where a lookup was available.

**The failure mode is specific and it is not ignorance.** It is *plausibility*: a flag that exists on a neighbouring command, a verb the product ought to have, an argument order that reads naturally. A guess that is nearly right is more expensive than one that is obviously wrong, because it fails late — after a file is written, an item is created, or a claim about the corpus is already in a report.

**Picking the wrong SURFACE does not fail — it succeeds differently.** The same words create a different item depending on where they are written from: the MCP `create_item` stamps `origin: "agent"` in the handler, while the CLI's `add` claims `origin: "human"`. For a normative category that difference is the whole trust boundary — one lands in `draft` awaiting a human, the other is active immediately. A wrong flag is refused and costs a round trip; a wrong surface is accepted and costs the boundary. So read the topic for the surface, not only for the syntax.

**It applies hardest where you feel most fluent.** The commands used twenty times today are exactly the ones whose flags get assumed. `add` and `edit` take overlapping but different flags; that overlap is the trap.

**And it applies to a subagent brief.** A brief that spells a command wrong sends an agent to discover the error rather than do the work — and an agent told the wrong syntax confidently will often work around it instead of questioning it. Quote syntax you have read, not syntax you remember.

**What this does not mean.** Not that every invocation needs a help call first — a command you just read the usage for, in this session, is read. It means the lookup is the default when you are reaching for a flag, an argument order, or a command name you have not confirmed **here**, and that a failed invocation is a signal to read rather than to try a variation.
