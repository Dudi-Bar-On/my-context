---
id: TASK-the-audit-stream-cannot-say-what-a-lane-was-doing-at-a-given
type: task
title: the audit stream cannot say what a lane was doing at a given minute, only that it ran
status: active
severity: soft
always: false
summary: A lane records only its purpose and its outcome, so the step-by-step work it did is visible in the terminal and nowhere afterwards.
summary_of: 26f8859d1874dab0
scope:
  - src/hooks/subagent-stop.ts
  - src/core/audit.ts
  - src/hooks/io.ts
tags:
  - v2
  - hooks
  - audit
  - "plan:hooks"
  - "seq:25"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 67d090fa2a0d355f
plan: hooks
seq: "25"
state: doing
priority: "2"
---

# the audit stream cannot say what a lane was doing at a given minute, only that it ran

The terminal narrates a running lane a line at a time, for example "general-purpose Reading
audit-new-ops.test.ts family order". That narration is not kept. Two rows survive a lane today,
agent-dispatched carrying its purpose and subagent-stop carrying its outcome, and between them
there is nothing. The owner asked for those intermediate lines to reach the audit stream.

The work is already recorded and needs no new hook on the hot path. Each lane writes its own
JSONL transcript, distinct from the parent, and SubagentStop delivers its location as
agent_transcript_path, declared in hooks/io.ts. Measured on this project: the file holds one
record per turn with message.content carrying tool_use blocks that name the tool and its input,
alongside toolUseResult, timestamps and an agentId on every row. The parent transcript contains
none of it, measured at zero sidechain records, so this file is the only source.

What to build: on SubagentStop, read that transcript once and append one audit row per tool call,
each carrying the tool name, a short subject such as the file or command it acted on, the
timestamp from the record, and the agentId that joins it to the dispatch and stop rows already
written. A row is a step, not a payload: the subject is a phrase a reader recognises, never the
whole input, because inputs carry file contents and command output and the log is not a copy of
the work.

Volume is the known cost and was accepted deliberately: about 150 rows for one lane, so a six-lane
wave adds roughly nine hundred. Confirm the segment rotation already present in core/audit.ts
handles that growth before landing, because this changes the log from tens of rows a day to
thousands.

Three failure modes the implementation must survive, since this runs inside a hook and
INV-hooks-fail-open governs it. A transcript may be absent or empty, measured at 19 of 45 files
in one session, and that must record nothing rather than fail. A transcript may be large, measured
at 1.7 MB for a single lane, so the read must be bounded and must not delay the hook. And a record
shape may be unrecognised, since the schema belongs to the harness rather than to this project, so
an unknown block is skipped rather than guessed at.
