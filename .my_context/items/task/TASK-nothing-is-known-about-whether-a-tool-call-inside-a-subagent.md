---
id: TASK-nothing-is-known-about-whether-a-tool-call-inside-a-subagent
type: task
title: nothing is known about whether a tool call inside a subagent can be observed as it happens
status: active
severity: soft
always: false
summary: A lane is invisible between starting and stopping, and it has never been tested whether the platform can report its work while it runs.
summary_of: 9229e1ad77045fdd
scope:
  - hooks/hooks.json
  - src/hooks/io.ts
  - reports/probes/**
tags:
  - v2
  - hooks
  - audit
  - probe
  - "plan:hooks"
  - "seq:30"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: ac0e7f0f50f6de96
plan: hooks
seq: "30"
state: todo
priority: "1"
---

# nothing is known about whether a tool call inside a subagent can be observed as it happens

The owner watches the audit stream while work is running and wants to see events as they arise.
Today he sees a lane dispatched, a lane started, then nothing until it stops, when every step it
took arrives at once. He asked why a start can be seen and not the middle.

Three things were measured on 2026-09-04 and all three say the middle is unavailable. The
SubagentStart hook fires once and reports only that a lane began. Thirty-six post-tool-use and
post-tool-use-failure rows exist in this log and NONE carries an agent id, every one being a tool
call made by the main session rather than by a lane. And a running lane transcript measured 0
bytes and stayed 0 across four seconds while that lane was demonstrably working, so the file is
written when the lane ends rather than streamed.

What none of that establishes is whether the platform COULD report it. The PostToolUse matcher
currently names Write, Edit, MultiEdit and Agent, so a lane reading a file or running a command
would fire nothing regardless, and the absence of agent-attributed rows may be a consequence of
the matcher rather than of the platform. Evidence of absence under one configuration is not proof
that another configuration behaves the same.

This distinction decides a feature. If a hook fires inside a lane and carries an id identifying
it, live steps cost one matcher change. If it does not, live steps are impossible by any route
currently available and the backfilled record is the only thing that can exist. Those are very
different answers and only one of them should be told to the owner.

What to do: probe it rather than reason about it, in the shape the two existing probe records
under reports use. Widen the matcher temporarily in a throwaway or against a deliberate test
dispatch, capture what actually arrives, and record which events fire inside a lane, whether any
carries an agent identifier, and how the timing relates to the tool call. Capture keys and never
values, since a payload carries prompts and file contents.

Then reverse the temporary change and write the finding down whichever way it falls. A negative
result closes a question that has now been answered three different ways in one day, twice
wrongly, and that is worth as much as a positive one.

Note before starting: the owner reverted a PreToolUse matcher widening once, ruling that bash in
general should allow writes and that the way to stop an agent bypassing the app is not a blanket
block. A probe is temporary and is not that, but the permanent change a positive result would
imply — a hook on every tool call in every project that installs this plugin — is exactly the
kind of thing he rules on rather than inherits.
