---
id: TASK-a-builder-for-edit-needs-an-endpoint-because-its-flags-are
type: task
title: a builder for `edit` needs an endpoint, because its flags are per-workspace
status: active
severity: soft
always: false
summary: The edit command allows different options in every project, so a form for it must ask the server what is legal rather than use a fixed list.
summary_of: 16577a4302e19eb5
scope: []
tags:
  - "plan:builder"
  - "seq:2b"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: b62e0a0dbf6c974f
state: done
plan: builder
seq: 2b
needs: builder/1b
progress: "100"
last_change: 2026-08-31
---

# a builder for `edit` needs an endpoint, because its flags are per-workspace

Found by plan:builder seq:1 while measuring, and it is the one command that RESISTS a static catalogue entirely.

`edit`'s accepted flag set is `[...ALLOWED, ...declaredFlags(ws.config)]` - computed per workspace from the flags THIS project's categories declare in their `updates` block. There is no static entry that is true: a project declaring `state` on `task` accepts `--state`, and a project that does not, does not.

`--unlink <relation> <target>` is a second reason: two operands, stripped from argv by `takeUnlinks` before any shared helper sees them, so a flag/value model does not describe it either.

SO THE BUILDER FOR `edit` CANNOT BE DRIVEN BY THE CATALOGUE. It needs an endpoint serving the resolved flag surface for the workspace being served - which is a small read model over `declaredFlags`, and is exactly the kind of thing `/api/config` already does for the config.

Worth noticing that this is the requirement working: the owner asked that syntax be enforced by the selections, and the one command whose syntax is defined by the USER is the one that needs the server to say what it is.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. The one command that RESISTS a static catalogue: edit s accepted flag set is [...ALLOWED, ...declaredFlags(ws.config)], computed per workspace from what THIS project s categories declare in their updates block, so no static entry is true. Plus --unlink <relation> <target>, two operands stripped by takeUnlinks before any shared helper sees them, which a flag/value model does not describe either. It is correctly scoped as its own task and should be sequenced AFTER seq:4, because the endpoint that answers "would the CLI accept this argv" is the same endpoint that can answer it per workspace.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.
