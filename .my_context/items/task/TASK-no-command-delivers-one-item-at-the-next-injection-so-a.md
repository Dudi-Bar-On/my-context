---
id: TASK-no-command-delivers-one-item-at-the-next-injection-so-a
type: task
title: no command delivers one item at the next injection, so a spilled item cannot be recovered deliberately
status: active
severity: soft
always: false
summary: A reader who decides a dropped item is needed has no way to send it, because the only tools are permanent or reshape everything else.
summary_of: d05c75bff085f34b
scope:
  - src/cli/commands/**
  - src/core/ledger.ts
  - src/core/select.ts
tags:
  - v2
  - cli
  - injection
  - budget
  - "plan:budget"
  - "seq:10"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 47b168e010dbc5fe
plan: budget
seq: "10"
state: todo
priority: "2"
---

# no command delivers one item at the next injection, so a spilled item cannot be recovered deliberately

Owner ruling 2026-09-04: a one-shot carry, spent on the next injection. His words were that
he should be able to select spilled items and act to inject them if he thinks they are
required, which is a judgement about NOW rather than forever.

Nothing today expresses that. Pin delivers every session permanently and prices the shared
pinned tier that 36 items already compete in, so a forgotten pin quietly starves the others.
Focus narrows what a session receives, so using it to force one item changes what else
arrives, which is a large side effect for a small intent.

What to build: a command that marks one item for delivery at the next injection regardless of
budget, and then forgets it. It reuses the carried machinery that already tracks what reached
the window. Pin keeps its present meaning and is not touched.

The web UI must COMPOSE this and never run it, as its own navigation requires, the same way
the doctor screen composes a settlement. It is a write, so it belongs on the derived approval
boundary with the rest of the write surface.

Decide and state, rather than assume: what happens to a carry that is never spent because no
injection follows, and whether carrying an item already in context is refused as pointless or
allowed as harmless. The first list, built separately, is what tells a reader which case they
are in.
