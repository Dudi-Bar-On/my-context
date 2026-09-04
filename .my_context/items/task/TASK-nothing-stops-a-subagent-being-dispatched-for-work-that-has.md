---
id: TASK-nothing-stops-a-subagent-being-dispatched-for-work-that-has
type: task
title: nothing stops a subagent being dispatched for work that has no task item
status: active
severity: soft
always: false
summary: An agent can be sent to do work the corpus has no record of, and only good intentions prevent it.
summary_of: f9c3fb496f269dc0
scope:
  - hooks/hooks.json
  - src/hooks/pre-tool-use.ts
  - src/core/config.ts
tags:
  - v2
  - hooks
  - process
  - tracking
  - "plan:hooks"
  - "seq:28"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 02364258ee152141
plan: hooks
seq: "28"
state: done
priority: "1"
verified_on: 2026-09-04
---

# nothing stops a subagent being dispatched for work that has no task item

Owner instruction, 2026-09-04: the enforcement must be part of the app rather than a note to one
assistant, so it ships wherever my_context is installed and survives a new session, a new
machine and a different reader.

What exists today is advisory only. A pinned instruction states the rule and a session memory
repeats it, and both were already in force in spirit on the day three lanes were dispatched with
no item behind them. An instruction that has already failed is not a mechanism.

The shape to build, and the machinery is mostly here. PreToolUse already returns a deny with a
reason and records an audit row under the deny op, which is how writes into the corpus directory
are refused today. The same path can refuse an Agent dispatch whose prompt names no task item
that exists in the corpus, and say which item is missing rather than only that something is.

It must be CONFIG GATED and OFF by default. Installing my_context must never suddenly begin
refusing a project the subagents it has always dispatched, and the owner has already ruled that a
stricter structure is something a project opts into rather than inherits. The precedent to follow
is the existing subsystem switches rather than a tuned number.

It must carry an audited escape hatch, because some dispatches legitimately have no item. A hook
payload was captured on the same day by a lane created only to fire one, and that was real work
with no task behind it. So the exception is a phrase written deliberately into the prompt, and
the reason travels into the audit row beside the dispatch. This project already works this way:
a summary left unchanged is declared, a bulk settlement consents by a count, a skipped item is
named. An exception nobody can see afterwards is the thing being prevented.

And it must fail OPEN on any error. Hooks fail open here as an invariant, and a deliberate refusal
is a different thing from a crash: if the check itself throws, cannot read the corpus, or meets a
payload it does not recognise, the dispatch proceeds. A bug in a guard must never be able to stop
a person working.

Two things to establish before building rather than assume. Whether the prompt or the description
is the right field to read, since both are on the payload and only one is written by a person
thinking about the task. And what an item reference looks like well enough to match without
matching prose that merely mentions an id, because a gate that fires on a quotation is a gate
people learn to route around.
