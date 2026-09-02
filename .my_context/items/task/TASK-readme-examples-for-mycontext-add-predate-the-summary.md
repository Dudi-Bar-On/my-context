---
id: TASK-readme-examples-for-mycontext-add-predate-the-summary
type: task
title: README examples for mycontext add predate the --summary requirement and now fail when copied
status: active
severity: soft
always: false
summary: Some README example commands now fail as written, and the check meant to catch bad examples cannot see them because it never scans that kind of code block.
summary_of: 6a03a9df7895081f
scope: []
tags:
  - docs
  - readme
  - examples
  - summary-gate
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: 4f311d2bad4ae074
state: todo
---

# README examples for mycontext add predate the --summary requirement and now fail when copied

mycontext add began requiring --summary on 2026-09-02. Four example invocations of
`mycontext add invariant "Prices are integer cents" --scope "src/billing/**" --yes` and
`mycontext add rule "Write the failing test first" --yes` /
`mycontext add constraint "Never commit a secret" --severity hard --yes` in the shipped
READMEs predate that change and carry neither --summary nor --summary-omitted. A reader
who copies them hits the refusal in cmdAdd.

Both languages are affected identically:
- my-context/README.md around lines 25, 145, 1747 and 1748
- my-context/docs/README.he.md at the equivalent lines (61, 183, and the pair near 1837)

The deeper issue, and the reason this needs an owner's attention rather than a quick fix:
these examples sit in plain ```bash fences with no `<!-- example: ... -->` / `<!-- /example -->`
marker around them, so test/docs/examples.test.ts never reaches them — it only verifies marked
blocks. No gate caught this drift. A reader trusts a README example exactly as much as a tested
one, but these four are invisible to the thing that is supposed to keep examples honest.
