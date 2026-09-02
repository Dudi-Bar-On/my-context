---
id: TASK-help-the-tools-topic-derived-plus-what-is-stamped-what-is
type: task
title: "help: the tools topic - derived, plus what is stamped, what is refused, and the CLI equivalence"
status: active
severity: soft
always: false
summary: "A help page for the tool interface: what it records automatically, what it refuses and why, and how it lines up with the command line."
summary_of: f4c0224dcc19a29e
scope: []
tags:
  - "plan:rulings"
  - "seq:30"
  - "state:done"
  - v2
  - help
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 743304cff6407275
plan: rulings
seq: "30"
state: done
progress: "100"
priority: "2"
source: src/help/index.ts
last_change: "2026-08-21T00:49:59Z"
---

# help: the tools topic - derived, plus what is stamped, what is refused, and the CLI equivalence

OWNER RULING, 2026-08-21: split the INVOCATION, share the CONCEPTS.

The concepts — categories, scope, tiers, the trust boundary — are identical for every reader, so they stay single-source in the existing topics. Two documents explaining scope would drift, and drift between two copies of one idea is this project most-repeated failure: the mockup versus plan 3 (48 keys apart), the plan versus the code, README versus README.he.

Only the INVOCATION differs, and there are THREE surfaces, not two: the CLI (used by humans AND by the assistant through Bash), the slash commands, and the MCP tools.

THIS TASK IS THE TOOLS TOPIC. It carries four things, all ruled:

1. Every tool, argument and default, DERIVED from the MCP tool registry — not written. capture.md`s ## Tools section already generates the tool descriptions; follow that coupling rather than adding a second list that rots.

2. WHAT IS STAMPED VERSUS ACCEPTED. origin is never taken from a tool call — the handler stamps agent. This is the single thing the assistant got wrong: it concluded across several exchanges that an agent could not record a lesson at all, because nothing said create_item already does it.

3. WHAT EACH TOOL REFUSES, AND WHY. Agent-authored normative content lands draft; scope/always/severity are refused on a governing item; an unknown extra field is refused by name. Refusals are where an agent wastes the most time, because a refusal reads as a bug until you know it is the design.

4. A CLI-VERSUS-TOOL EQUIVALENCE TABLE, including where they deliberately differ: relations have no CLI spelling at all, and lesson --agent is SELF-DECLARED where create_item is handler-stamped.

Depends on the cli topic landing first — both edit HELP_TOPICS in src/help/index.ts and the literal list in test/help/help.test.ts.
