---
id: TASK-the-parity-check-cannot-tell-a-sub-command-from-a-sibling-so
type: task
title: the parity check cannot tell a sub-command from a sibling, so one command reads as covered by a tool that does not wrap it
status: active
severity: soft
always: false
summary: A prefix rule makes one command look covered by a tool built for a different command that merely shares its first word.
summary_of: dbeb9610159ff006
scope:
  - src/plugin/parity.ts
  - test/plugin/parity.test.ts
tags:
  - v2
  - parity
  - mcp
  - "plan:mcp"
  - "seq:7"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 594dd6d1b0c83f49
plan: mcp
seq: "7"
state: done
priority: "1"
verified_on: 2026-09-04
---

# the parity check cannot tell a sub-command from a sibling, so one command reads as covered by a tool that does not wrap it

The reverse parity declaration asserts that every CLI command either has an MCP tool or is
listed with a reason. It decides coverage with a prefix rule: a command counts as covered when
a tool names it exactly, or names something beginning with that command and a hyphen.

That rule was written for a real case, where a hyphenated name is a SUB-FORM of the base
command, and it holds there. It cannot tell a sub-form from a SIBLING. Measured on 2026-09-04:
a tool was added wrapping the command that stages rule candidates, and the bare lesson command
immediately read as covered by it, because one name begins with the other. The usage banner
lists them as separate commands doing different things, one capturing a lesson and one staging
candidate rules, and no tool wraps the first at all.

The consequence is the one the declaration exists to prevent. Its own derived test forced the
bare command to be removed from the owed list, so the table now asserts coverage that does not
exist, and the gap is invisible exactly where a reader would go to look for gaps. It was found
only because a lane noticed the count fall by one more than it expected and said so.

What to build: make coverage answer whether a tool actually reaches the command, not whether
two names share a first word. Establish first, from the command registry rather than from the
strings, which hyphenated names are genuinely sub-forms invoked through their base and which are
independent commands that merely share a prefix, because the answer decides whether the rule
needs replacing or only narrowing. Then restore the entry that was removed, with its real
disposition, and add a case that pins a sibling apart from a sub-form so the rule cannot quietly
widen again.

Worth checking while in this code, and reporting rather than assuming: whether the sub-form case
the rule was originally written for still exists as a command at all, since the usage banner now
shows only the base. A rule kept for a case that has gone is a rule with no defender.
