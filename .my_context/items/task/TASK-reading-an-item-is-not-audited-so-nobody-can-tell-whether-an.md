---
id: TASK-reading-an-item-is-not-audited-so-nobody-can-tell-whether-an
type: task
title: reading an item is not audited, so nobody can tell whether an index line was ever followed
status: active
severity: soft
always: false
summary: Item fetches leave no record, so whether a reader ever acted on an index line is unmeasurable rather than merely unknown.
summary_of: dc4b26f0f2e15827
scope:
  - src/core/audit.ts
  - src/cli/commands/context.ts
  - src/cli/commands/query.ts
tags:
  - v2
  - audit
  - injection
  - "plan:budget"
  - "seq:15"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 43a200efbea1231f
plan: budget
seq: "15"
state: todo
priority: "2"
---

# reading an item is not audited, so nobody can tell whether an index line was ever followed

Found while answering the owner’s question on 2026-09-04 about whether an agent given only
an item name can be made to read its body. The question could not be answered from the log.

ACCESS_OPS is ui-refused and nonce-minted. An item fetch through show, get_item or the web is
not among them, so no record exists that anyone ever followed an index line. That is an
unmeasured thing and this project draws a measured zero differently from an unmeasured one,
so it must not be reported as never happened.

This matters beyond one question. The index tier exists on the premise that a name is enough
because it can be followed. Nothing tests that premise, and a premise that cannot be tested
is being taken on faith in the middle of the mechanism this project is for.

What to build: record an item read as an audit op, with what was fetched and by what surface,
so the index tier can be evaluated rather than assumed. Ops are a closed list grouped in
families with a validate that refuses an unknown op, so this is an addition to that list and
must be made the way the list requires rather than around it.

Keep what is recorded to ids and surfaces. A fetch payload carries item text and the audit
log is not the place to copy the corpus into.

Then the honest question becomes answerable: of the items that arrived as index lines, how
many were ever read.
