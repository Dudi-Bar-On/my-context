---
id: TASK-the-archive-borrows-claude-code-own-session-name-and-never
type: task
title: the archive borrows Claude Code own session name and never offers one of its own
status: active
severity: soft
always: false
summary: "The archive shows the name Claude Code gave a session and offers no way to give it one of its own; seq:10 says that silence is not defensible either way."
summary_of: 99d38815e8f42989
scope:
  - src/ui/**
  - src/core/conversation-index.ts
  - src/cli/commands/conversation.ts
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:34"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: ddf04862ca7530b0
plan: archive
seq: "34"
state: todo
priority: "3"
---

# the archive borrows Claude Code own session name and never offers one of its own

plan:archive seq:10 left this open in its own words: the spec says the title is taken from the transcript own aiTitle AND OVERRIDABLE for a session worth naming; my_context provides no override anywhere - not in the CLI, not on the screen; what exists is Claude Code own rename, borrowed. It says either building the override or recording that the harness owns naming is defensible, but the current silence is not.

WHAT WAS BUILT ON 2026-09-09 AND WHAT WAS NOT. seq:10's list work shipped - filter, search across sessions, and duration - and this clause did not. The lane took the cheaper-to-reverse half deliberately and this item is that choice written down rather than left as silence.

THE PROVISIONAL DECISION: THE HARNESS OWNS NAMING. The index carries title and title_source and reports which of the two it got - a person's custom-title.json, or the model's own ai-title record - and the screen already says (named by the model) when it was the model. Nothing in my_context writes either. Measured on this workspace 2026-09-09: 2 sessions, one titled MyContext V2.0 with title_source custom and one with no title at all, drawn as Untitled session.

WHY THIS SIDE, AND WHAT REVERSING COSTS. An override is a WRITE and this archive has exactly one writer - mycontext conversation rebuild - so the override needs a column the rebuild must learn not to overwrite, a CLI subcommand, and a rule for what happens when the harness renames a session that already carries our name. Recording the borrowing costs nothing and blocks nothing. Reversing is additive: a title_override column beside title, one CLI subcommand, and the screen preferring it - roughly the shape of the two columns already there. Nothing built on 2026-09-09 has to be undone first.

WHAT MAKES THE SILENCE END EITHER WAY. The list draws the title, says when the model wrote it, and says Untitled session when there is none. What it does not draw anywhere is the session ID - measured by driving the screen: a row is title, day, counts, lanes, duration, branch, size, and no id. The search READS the id (it is what the URL and mycontext conversation subagents address a session by, so a reader holding one can paste it) but nobody can read one off this list. If the owner wants naming, that asymmetry is the argument for it.
