---
id: TASK-a-handover-is-asked-for-on-demand-from-the-cli-a-slash
type: task
title: a handover is asked for on demand from the CLI, a slash command and an MCP tool
status: active
severity: soft
always: false
summary: Three ways to tell the system you want to wrap up now, all reaching the same single decision underneath.
summary_of: 089f742ec92dab55
scope:
  - src/core/handover-ask.ts
  - src/cli/**
  - commands/**
  - src/mcp/**
tags:
  - v2
  - handover
  - cli
  - mcp
  - "plan:handover"
  - "seq:14"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 5319526de5e98fad
plan: handover
seq: "14"
state: done
priority: "2"
verified_on: 2026-09-06
---

# a handover is asked for on demand from the CLI, a slash command and an MCP tool

Owner ruling 2026-09-06 (plan D18). Implements shape (a) of
OPENQ-nothing-triggers-a-handover-on-demand-and-a-handover-written, on all three surfaces.

THE DEFECT IT CLOSES, measured: `checkHandoverAsk` reads the latch and returns on a null `askedAt`
BEFORE it ever stats the file. So a handover written by hand at 40% - current, complete, correct -
reports `not-asked` with `writtenAt: null`, and both surfaces say "no handover ask yet". A person who
prepared early is told nothing is prepared. This is D14 pointing the other way: D14 was a stale file
reported current; this is a current file reported absent.

THE CENTRAL DESIGN PROBLEM IS THE SESSION IDENTITY, and it is different per surface. The latch is
per session at `state/<sanitized-session-id>.handover-ask.json`. A CLI command run in a terminal does
not know the Claude Code session id; a slash command and an MCP tool are much closer to one. The
statusline bridge under `.my_context/.statusline/<sessionId>.json` records a payload with
`receivedAt` per session and is the obvious candidate for resolving "the live session" - but
"most recently received" is a heuristic, and a wrong guess stamps the WRONG session’s latch. What
happens when identity cannot be established must be a REFUSAL, never a guess: `no-identity` already
exists as a verdict.

THE OCCUPANCY MUST NOT BE INVENTED. The ask stamps `askedAtPercent`, and the whole value of D14 is
that this number is true. If the occupancy cannot be read, the command refuses or records absence -
it does not default to the threshold, to zero, or to the last value seen.

A SLASH COMMAND IN THIS PRODUCT IS A MARKDOWN FILE that expands into an instruction, not code. So the
three surfaces are not three implementations: the core decision lives once in src/core/, the CLI
wraps it, the MCP tool wraps it, and the slash command names one of them. Say in the item which.

EVERY DERIVED COUNT MOVES, and this project measures that drift in days - the catalogue said "38
commands" and was right on 2026-08-24. A 44th command, a 91st slash command and a 26th MCP tool
touch the registry, COMMAND_FLAGS, both READMEs, the help topics, the Composer catalogue and the
generated coverage document. None of those numbers may be hand-edited into agreement; they are
derived or they are wrong.

THE TEST HAZARD IS SPECIFIC AND SERIOUS. The latch for the LIVE session is a real file under
.my_context/state/. A test that stamps it would put a false ask on the owner’s statusline and could
trigger a spurious handover ask in his running session. Tests use a temporary root or a fabricated
session id - never the live one. This is the one case where "test against the current corpus" must
not be read as "write to the current corpus".
