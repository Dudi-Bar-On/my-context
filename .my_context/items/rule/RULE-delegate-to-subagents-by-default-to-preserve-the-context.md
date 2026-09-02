---
id: RULE-delegate-to-subagents-by-default-to-preserve-the-context
type: rule
title: Delegate to subagents by default to preserve the context window
status: superseded
severity: hard
always: true
summary: A rule that reading and searching are handed to subagents by default, keeping the main conversation free for judgement rather than bulk text.
summary_of: 63e0768c6b2b8888
scope: []
tags:
  - process
  - context
  - agents
origin: human
source_file: null
source_anchor: null
source_checksum: 22a107771ad2f9a9
valid_from: 2026-08-19
valid_until: 2026-08-19
checksum: cb61236a57d9148b
---

# Delegate to subagents by default to preserve the context window

Delegate to subagents by default, and reserve the main context window for
judgement rather than for reading.

**The rule.** Whenever a task can be handed to a subagent, hand it to one. Run
as many as the work genuinely divides into, and run independent ones
concurrently in a single message rather than one at a time.

**What belongs in a subagent:** searching, reading files to answer a question,
sweeping a codebase, verifying a claim against source, running and interpreting
a test suite, drafting a document section, and any research whose *output* is
short but whose *input* is long.

**What stays in the main thread:** decisions the owner must make, anything that
writes to the corpus, and the final synthesis — a subagent returns findings, and
weighing them is not delegable.

**Why this is a rule and not a preference.** A subagent's tool output never
enters this context window; only its conclusion does. Reading twenty files
inline costs the whole window and leaves less room for the reasoning the window
exists for. The same work behind a subagent costs a paragraph. Compaction is
lossy and the corpus is the durable record — spending the window on file dumps
is spending the one resource that cannot be recovered.

**The limit that keeps it honest.** Do not delegate work whose result cannot be
checked. A subagent's report is evidence, not testimony: claims about shipped
behaviour still get verified against source before they are asserted, exactly as
if they had been made here.

## Relations
- superseded_by [[RULE-delegate-to-subagents-reserve-the-context-window-for]]
