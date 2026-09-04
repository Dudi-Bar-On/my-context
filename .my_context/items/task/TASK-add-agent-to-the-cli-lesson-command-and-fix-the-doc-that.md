---
id: TASK-add-agent-to-the-cli-lesson-command-and-fix-the-doc-that
type: task
title: add --agent to the CLI lesson command, and fix the doc that says an agent cannot record one
status: active
severity: soft
always: false
summary: Recording a lesson from the command line forces it to be labelled as written by a person, and the documentation wrongly says a tool cannot record one.
summary_of: 8c7a367f22481f9f
scope: []
tags:
  - "plan:rulings"
  - "seq:28"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 5708b238bd1d1997
plan: rulings
seq: "28"
state: done
progress: "100"
priority: "1"
source: src/cli/commands/lesson.ts
last_change: "2026-08-20T17:42:46Z"
---

# add --agent to the CLI lesson command, and fix the doc that says an agent cannot record one

OWNER INSTRUCTION, 2026-08-20. Two parts.

CODE: src/cli/commands/lesson.ts hardcodes origin: 'human', so from a shell the ONLY available path is the dishonest one. Add --agent, which records origin: 'agent'. lesson is RATIONALE tier and trustedStatus forces draft only for normative, so an agent-recorded lesson lands active and honest.

DOC: src/plugin/commands.ts generates commands/lesson.md and says an agent may not run it - true of the CLI, but it never mentions that create_item on the MCP server ALREADY records agent-origin items, stamping origin in the handler and refusing to take it from the tool call. That omission cost a full detour today: I concluded the capability did not exist.

NOT lesson-accept. Accepting a staged rule is a normative act and must stay human-only.
