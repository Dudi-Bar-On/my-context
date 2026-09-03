---
id: TASK-relations-have-no-cli-spelling-so-the-terminal-cannot-write
type: task
title: Relations have no CLI spelling, so the terminal cannot write one at all
status: active
severity: soft
always: false
summary: The command line cannot record a relation between two items at all; only the MCP server can, which split the merge in half.
summary_of: f775aa9da9f45ff5
scope: []
tags:
  - v2
  - cli
  - relations
  - "plan:rulings"
  - "seq:54"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 269c4aa1fd416a90
plan: rulings
seq: "54"
state: todo
priority: "2"
---

# Relations have no CLI spelling, so the terminal cannot write one at all

Owner instruction, 2026-09-04: "support relation using the cli too".

WHAT IS MISSING

`link_items` exists only on the MCP server. The CLI has no verb for a relation at all - `mycontext link` does not exist, and `add` and `edit` have no flag that writes one. The only relation the CLI can write is the `supersedes`/`superseded_by` pair, and only through `mycontext supersede`, which writes it as a side effect of a lifecycle change rather than as a relation in its own right.

WHY THIS COST SOMETHING ALREADY, MEASURED

The 44-item merge of 2026-09-04 carried 27 relation edges. Twelve of them were writable, and not one could be written from the terminal: the migration ran entirely through `mycontext add`, and the relations had to wait for the MCP server. When that server was found to be serving code loaded the previous night, the twelve edges were blocked on restarting it. A corpus operation that the CLI can otherwise perform end to end stopped for want of a verb.

It also splits the surface in a way `TOOL_PARITY` was built to prevent, and in the direction the reverse-parity work names: every MCP tool is asserted to have a user counterpart, and this one has none.

WHAT IT MUST DO

Write a typed relation between two existing items, refusing what `link_items` refuses: a self-link; `supersedes` and `superseded_by`, which assert a lifecycle change and belong to `supersede`; and a duplicate edge, which is ignored rather than an error. The relation is stored on the `from` item and is not symmetric.

The vocabulary is `RELATION_TYPES`, which the CLI must read rather than restate - a hand-kept list beside a derived one is this project signature defect, and `link_items.relation` already carries the enum for exactly that reason.

WHAT TO SETTLE WHILE BUILDING IT

Whether the verb also removes an edge. `edit` already has `--unlink <relation> <target>`, so removal has a spelling and creation does not, which is the wrong way round.

Whether it takes the approval boundary. A relation changes what governs nothing on its own, and `link_items` is `boundary: false` in the palette - but the CLI decides its own gate, and the boundary is derived from which commands accept `--yes` rather than listed.
