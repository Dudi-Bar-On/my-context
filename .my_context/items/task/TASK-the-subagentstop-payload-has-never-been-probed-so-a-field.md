---
id: TASK-the-subagentstop-payload-has-never-been-probed-so-a-field
type: task
title: the SubagentStop payload has never been probed, so a field shipped on a declaration nobody measured
status: active
severity: soft
always: false
summary: A hook field was declared and then read by a new feature without anyone ever checking a real payload carries it.
summary_of: 36907f3362eb6d22
scope:
  - src/hooks/io.ts
  - src/hooks/subagent-stop.ts
  - reports/probes/**
tags:
  - v2
  - hooks
  - audit
  - "plan:hooks"
  - "seq:26"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 6fe6d8b4a131442a
plan: hooks
seq: "26"
state: todo
priority: "2"
---

# the SubagentStop payload has never been probed, so a field shipped on a declaration nobody measured

There are probe records for the clear and prompt hooks under reports/probes, and none for
SubagentStop. Its fields live only as declarations in src/hooks/io.ts, and that file states
the rule this breaks in its own words: a declared field nothing reads is a claim about the
payload that no test can hold up.

It stopped being harmless on 2026-09-04. The agent-step backfill was built to read
agent_transcript_path, which had been declared for weeks and never measured, and the whole
feature was verified against a hand-built payload envelope rather than a live one. Because
the guard returns silently when the field is missing, an absent field and a working feature
would have looked identical from the log. A temporary probe settled it: the field IS
delivered, and the feature does work. It worked unverified, which is luck rather than
engineering.

Measured that day from two real firings, and worth recording so the next reader starts from
data. The keys present were agent_id, agent_transcript_path, agent_type, background_tasks,
cwd, hook_event_name, last_assistant_message, permission_mode, prompt_id, scratchpad_dir,
session_crons, session_id, stop_hook_active and transcript_path, with effort on one of the
two. Five of those are undeclared: scratchpad_dir, background_tasks, session_crons, prompt_id
and effort, alongside last_assistant_message which the handover had already noted.

One firing carried a transcript path whose file did not exist, so the backfill guard against
a missing file is load-bearing rather than defensive theatre.

What to build: a probe record under reports/probes covering SubagentStop, in the shape the
two existing records use, listing every field a real payload carries and marking which are
declared and which are not. Then reconcile io.ts against it, declaring what is read and
saying plainly what is on the wire and deliberately ignored. Capture keys and never values,
because last_assistant_message carries prose and transcript_path carries a path into a
private directory.
