---
id: LESSON-stage-what-an-agent-reported-touching-not-what-you-told-it
type: lesson
title: stage what an agent reported touching, not what you told it it might touch
status: active
severity: soft
always: false
summary: Record the files a helper says it changed, not the ones you expected it to, or one person's work ends up filed under another's name.
summary_of: 986f263f41fe2976
scope: []
tags:
  - v2
  - process
  - subagents
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 87b75b6626486211
---

# stage what an agent reported touching, not what you told it it might touch

2026-08-24, caught by the agent whose commit it polluted rather than by any gate.

WHAT HAPPENED. Five agents shared one tree. The export-security agent's brief said 'if your change needs `export.ts`'s parser, make the smallest possible edit and say so prominently'. It made ZERO edits there and reported exactly that. When staging its commit I added `src/cli/commands/export.ts` anyway - because my brief had named the file, so I had it in mind as theirs.

Those 9 lines were the PARSER-LIFTING agent's `COMMAND_FLAGS` change. They are now recorded under a commit message that is entirely about screening pack metadata and bounding echoes, so the history attributes a mechanical lift to a security fix.

WHY NO GATE CAUGHT IT. Every gate was green, because the CODE was correct and complete - it was in the wrong COMMIT, and no test has an opinion about that. The only reader who could catch it was the agent that knew what it had not written.

THE RULE: stage by what the agent REPORTED touching, not by what the brief anticipated. A brief names files an agent MIGHT need; the report names files it DID change. When five agents share a tree those two lists diverge, and the anticipated one is always wider.

CHEAPEST CHECK, and it costs one command: run `git status --short` BEFORE dispatching and again before staging, and stage the difference the agent claims - not the difference the brief predicted. Better still, ask each agent to end its report with its own `git diff --name-only`, which the good ones already volunteer.

WHY IT WAS NOT REWRITTEN. Both commits were pushed and the code is correct. Rewriting shared history to move nine lines of a mechanical lift costs every other clone a reset for a provenance nit. Recording it is the proportionate answer - and the record is what makes the next wave cheaper.
