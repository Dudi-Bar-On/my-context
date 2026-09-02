---
id: RULE-normative-guidance-lives-in-mycontext-rule-items-never-in
type: rule
title: Normative guidance lives in mycontext rule items, never in .claude/rules
status: active
severity: hard
always: false
summary: Anything that governs how this project works is recorded in the project's own knowledge store, never in a loose rules file that nothing can account for.
summary_of: 340939d0310c1599
scope: []
tags:
  - v2
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 1aad09db79844cc6
---

# Normative guidance lives in mycontext rule items, never in .claude/rules

Instruction from the owner, 2026-08-22.

Claude Code added a .claude/rules directory in recent versions. This project does not use it. Everything normative - a rule, a constraint, an invariant, a standard - is a mycontext item, captured through the CLI or the MCP tools and carried into a session by the injection hooks.

The reason is the product's own argument. A rule in .claude/rules is a file that is loaded wholesale and is accountable to nothing: it has no category, no tier, no scope, no origin, no audit record, no decay, and no way to say why it was not injected. A rule item has all of those, and INV-nothing-is-dropped-silently applies to it. Keeping guidance in the corpus is also the only way this project eats what it cooks - a rule that lives outside mycontext is a rule mycontext cannot demonstrate handling.

This applies to agents dispatched by this project as much as to the main session: a brief may quote a rule, and the rule's home is the corpus.

Nothing needs migrating today - .claude/rules does not exist in this repository, and this rule is recorded before it can.
