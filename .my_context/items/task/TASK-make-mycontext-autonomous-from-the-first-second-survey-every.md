---
id: TASK-make-mycontext-autonomous-from-the-first-second-survey-every
type: task
title: "make mycontext autonomous from the first second: survey every integration surface and ship the settings"
status: active
severity: soft
always: false
summary: Survey every way this tool can plug into the editor and ship sensible defaults, so it helps from the moment it is installed with nothing configured.
summary_of: ec4f5dcf48e7ee06
scope: []
tags:
  - "plan:hooks"
  - "seq:22"
  - "state:todo"
  - v2
  - strategy
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 6d521cffb83d40bd
plan: hooks
seq: "22"
state: todo
priority: "1"
needs: hooks/16b
---

# make mycontext autonomous from the first second: survey every integration surface and ship the settings

Owner instruction, 2026-08-22. BLOCKED until the hooks programme completes - registering the ten ruled hooks, measuring each, and the re-survey of what is left unregistered. This task starts from that finished ground rather than beside it.

THE GOAL, in the owner's terms: a person installs mycontext and it manages their context intelligently from the first second, automatically, with minimal intervention. That is also what makes it desired and reputable - a context manager that needs to be configured before it helps has already lost the argument it exists to make.

THE SURVEY, and it must be RESEARCHED rather than recalled. Claude Code's extension surface is larger than hooks and changes between versions; read the current documentation and the shipped build, the way the clear probe did, and record the version everything was read on. At minimum:

- hooks - the ten being registered now, plus whatever the post-implementation re-survey adds
- skills - SKILL.md is always loaded and size-capped; what belongs in it versus in a rule item
- slash commands - 77 today, generated; which are missing, which are noise
- CLAUDE.md and the memory system - InstructionsLoaded now makes this visible to us; what should mycontext write, propose, or refuse to touch
- settings.json, settings.local.json and the permissions block - what the plugin should ship as a default and what stays the user's
- MCP server registration and its tool surface
- statusline - a tee already exists, no producer does
- agents, output styles, plugins, and anything the survey turns up that this list does not name

FOR EACH SURFACE, three questions: what would mycontext do here if nobody configured it; what must ship as a default; and what genuinely requires the user, which is then ONE decision rather than a form.

USE MYCONTEXT ON ITSELF where it applies. A setup sequence is a procedure. A recurring operation is a runbook. A default that must not be silently changed is a rule with a scope. If the tool cannot express a piece of its own installation, that is a product finding worth more than the setting.

CONSTRAINTS THAT DO NOT BEND: .my_context/config.json is the user's to make - the plugin may propose, never edit. INV-hooks-fail-open. INV-nothing-is-dropped-silently - a default that quietly does something is worse than no default. And every registration costs a process spawn: SubagentStart measured 338-413ms end to end, so the autonomous install must be measured as a whole, not assumed cheap because each piece was.

There is a claude-code-guide agent type available for the research half; it is the right tool for reading the platform's own surface.

DELIVERABLE: a report of what exists and what mycontext should do with each, a set of shipped defaults with the reasoning, and the list of decisions that genuinely remain the owner's - each one stated as a question with a recommendation, not as a blank.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND ITS BLOCK IS EFFECTIVELY OVER. Seventh stale blocker, and the only one that is holding a direct owner instruction.

It is "BLOCKED until the hooks programme completes -- registering the ten ruled hooks, measuring each, and the re-survey of what is left unregistered". plan:hooks TODAY: 32 done, 1 todo, 1 blocked -- and the 1 todo is seq:16b, a single missing SENTENCE in README section 8. The programme is complete; a documentation line is not the ground this task was waiting for.

IT SHOULD GO TO THE OWNER RATHER THAN BE UNBLOCKED SILENTLY, because it is his instruction of 2026-08-22 and because "survey every integration surface and ship the settings" is a scope he set. Confirm the ground is finished ground, then start.

AND IT IS ADJACENT TO A WHOLE CLASS THE RECONCILIATION KEEPS MEETING: settings this product accepts and does not honour (plan:rulings seq:42, ui.enabled), and facts it states without checking (the status strip s bridge, the Tutorials screen s checkmarks). An autonomy survey that ships settings should establish that each new one is READ.
