---
id: TASK-register-the-eight-remaining-hooks-and-re-review-what-is
type: task
title: register the eight remaining hooks, and re-review what is left after they land
status: active
severity: soft
always: false
summary: Listen for the eight remaining events the tool can be told about, then look again at what is left once those are in place.
summary_of: 94665464bc201bfe
scope: []
tags:
  - "plan:hooks"
  - "seq:21"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: a62db4943062eaf6
plan: hooks
seq: "21"
state: done
priority: "1"
---

# register the eight remaining hooks, and re-review what is left after they land

Ruled by the owner 2026-08-22 after a survey of the platform's own hook registry: mycontext registers six of thirty-one events, and the owner ruled to take every candidate the survey called valuable, not a subset.

Ruled in and dispatched first: SessionEnd (the only firing carrying a cleared session's old id) and PostCompact (the real compaction event, carrying compact_summary, where the restore tier currently infers compaction from SessionStart source=compact - a proxy).

Ruled in and still to build:
- FileChanged (file_path, change/add/unlink) - the corpus is Markdown a human edits by hand and the index is a projection; this is what makes INV-markdown-is-the-source-of-truth self-maintaining. Fires on every file, so the handler must filter and stay fail-open.
- InstructionsLoaded (file_path, memory_type, load_reason, globs) - fires when a CLAUDE.md loads. mycontext argues about what reaches a session and currently cannot see the other thing that does.
- ConfigChange (source, file_path) - config.json is the user's to edit and the program learns about the edit at the next session start.
- PermissionDenied (tool_name, tool_input, reason) - mycontext's own PreToolUse deny is what usually fires it.
- SubagentStop - closes the loop SubagentStart opens.
- Stop - end of an assistant turn; arguably where the capture nudge belongs rather than PostToolUse.
- Setup (trigger: init|maintenance) - the natural home for init and doctor.
- TaskCreated / TaskCompleted (task_id, task_subject) - would tie the harness's tasks to the corpus's own task category.

STANDING INSTRUCTION FROM THE OWNER: an agent may not decide against registering one of these. If a reason emerges, build it, measure it, and report the reason - the owner rules.

AND: after these land, redo the survey over the remaining unregistered events. A case for one of them may only become visible once these are in.

Every registration costs a process spawn. SubagentStart measured 338-413ms end to end including a cold node start. Measure each, report the numbers, and let the owner decide from them.
